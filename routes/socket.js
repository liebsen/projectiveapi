const jwt = require('jsonwebtoken')
const moment = require('moment')
let socketUsers = {}
let tokens = {}

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

  io.on('connection', function(socket){ //join room on connect

    socket.on('connect', function() {
      console.log("connect: " + tokens[socket.id].id)
    })

    socket.on('disconnect', function(a) {
      console.log("--disconnect: " + tokens[socket.id].id)
      for(var i = 0; i < socketUsers.length; i++ ){
        for(var j = 0; j < socketUsers[i].length; j++ ){
          if(socketUsers[i][j].socket === socket.id){
            console.log(socketUsers[i][j].code + " just disconnected")
            socketUsers[i].splice(j, 1)
          }
        }
      }
      io.emit('chat_users', socketUsers)
    })

    socket.on('chat_leave', function(id) {
      socket.leave(id)
    })

    socket.on('chat_join', function(data) {
      var exists = false
      let room = data.id
      console.log("chat_join:")
      console.log(JSON.stringify(data))

      if(!socketUsers[room]){
        socketUsers[room] = []
      }
      for(var i = 0; i < socketUsers[room].length; i++ ){
        if(socketUsers[room][i].code === data.code){
          exists = true
        }
      }
      if(exists === false){
        console.log(data.code + " joins. room: " + room)
        if(!socketUsers[room]){
          socketUsers[room] = []
        }
        socketUsers[room].push({
          code: data.code,
          socket:socket.id,
          observe: data.observe
        })
      }
      socket.join(room)
      io.emit('chat_users', socketUsers)
    })

    socket.on('chat_leave', function(data) {
      console.log("--leaves: " + tokens[socket.id].id)
      for(var i = 0; i < socketUsers.length; i++ ){
        for(var j = 0; j < socketUsers[i].length; j++ ){
          if(socketUsers[i][j].socket === socket.id){
            console.log(socketUsers[i][j].code + " just disconnected")
            socketUsers[i].splice(j, 1)
          }
        }
      }
      io.emit('chat_users', socketUsers)
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