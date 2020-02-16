const jwt = require('jsonwebtoken')
const moment = require('moment')
var socketUsers = {}

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

  let token = null
  io.use(async(socket, next) => {
    try {
      token = await validateToken(socket.handshake.query.token)
      return next()
    } catch(e) {
      return next(new Error('Authentication error'))
    }
  })

  io.on('connection', function(socket){ //join room on connect

    socket.on('connect', function() {
      console.log("connect: " + token.id)
    })

    socket.on('disconnect', function(a) {
      console.log("--disconnect: " + token.id)
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
      console.log("--leaves: " + token.id)
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
      io.to(data.room).emit('chat_line', data)
      /*
      for(var i in data){
        item[i] = data[i]
      }
     
      delete item.id 
      delete item.collection 
      item.updatedAt = moment().utc().format()      

      var ObjectId = require('mongodb').ObjectId
      return db.collection(data.collection).findOneAndUpdate(
      {
        '_id': new ObjectId(id)
      },
      {
        "$set": item
      },{ new: true }).then(function(doc){
        io.to(id).emit('data', data)
      })*/
    })
  })
}

module.exports = sockets