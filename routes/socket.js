const jwt = require('jsonwebtoken')
const moment = require('moment')
let socketUsers = []
let chatUsers = {}
let tokens = []

async function validateToken(token) {
  return new Promise((resolve, reject) => {
    if(typeof token !== 'undefined') {
      jwt.verify(token, process.env.APP_SECRET, function(err, decoded) {
        if(!err && decoded) {
          resolve(decoded)
          next()
        } else {
          reject(null)
        }
      })    
    } else {
      reject(null)
    }
  })
}

let sockets = (io, db) => {
  io.use(async(socket, next) => {
    try {
      tokens[socket.id] = await validateToken(socket.handshake.query.token)
      return next()
    } catch(e) {
      return next(new Error('Authentication error'))
    }
  })

  io.on('connection', function(socket){

    if(!socketUsers[socket.id]){
      socketUsers.push(tokens[socket.id].id)
    }

    console.log("connect: " + tokens[socket.id].id)
    io.emit('users', socketUsers)

    socket.on('disconnect', function() {
      console.log("--disconnect: " + tokens[socket.id].id)
      for(var i = 0; i < chatUsers.length; i++ ){
        for(var j = 0; j < chatUsers[i].length; j++ ){
          if(chatUsers[i][j].socket === socket.id){
            console.log(chatUsers[i][j].code + " disconnected from room")
            chatUsers[i].splice(j, 1)
          }
        }
      }

      socketUsers = socketUsers.filter(e => { return e != tokens[socket.id].id })

      console.log(socketUsers)

      io.emit('users', socketUsers)
      io.emit('chat_users', chatUsers)
    })

    socket.on('chat_leave', function(id) {
      socket.leave(id)
    })

    socket.on('chat_join', function(data) {
      var exists = false
      let room = data.id
      console.log("chat_join:")
      console.log(JSON.stringify(data))

      if(!chatUsers[room]){
        chatUsers[room] = []
      }
      for(var i = 0; i < chatUsers[room].length; i++ ){
        console.log("1")
        if(chatUsers[room][i].code === data.code){
          exists = true
        }
      }
      if(exists === false){
        console.log(data.code + " joins. room: " + room)
        chatUsers[room].push({
          code: data.code,
          socket:socket.id
        })
      }
      socket.join(room)
      console.log(chatUsers)
      io.emit('chat_users', chatUsers)
    })

    socket.on('chat_leave', function(data) {
      console.log("--leaves: " + tokens[socket.id].id)
      for(var i = 0; i < chatUsers.length; i++ ){
        for(var j = 0; j < chatUsers[i].length; j++ ){
          if(chatUsers[i][j].socket === socket.id){
            console.log(chatUsers[i][j].code + " just disconnected")
            chatUsers[i].splice(j, 1)
          }
        }
      }
      io.emit('chat_users', chatUsers)
    })

    socket.on('chat_send', function(data) { //data object emitter
      console.log("chat_send: " + JSON.stringify(data))
      let $push_query = []
      let selected = ['name','line']
      let copy = {
        sender: tokens[socket.id].id,
        created : moment().format()
      }      

      for(var i in data){
        if(selected.includes(i)){
          copy[i] = data[i]
        }
      }

      $push_query.push(copy)
      console.log(copy)
      console.log(data.room)

      db.collection('projects').findOneAndUpdate(
      {
        'tasks.id': data.room
      },
      {
        "$push": { "tasks.$.chat": { "$each" : $push_query } }
      },{ 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(doc){
        io.to(data.room).emit('chat_line', data)
      }).catch(function(err){
        console.log('err: ' + err)
      })
    })
  })
}

module.exports = sockets