var socketUsers = []

let sockets = (io, db) => {

  io.on('connection', function(socket){ //join room on connect

    socket.on('disconnect', function() {
      for(var i = 0; i < socketUsers.length; i++ ){
        if(socketUsers[i].socket === socket.id){
          console.log(socketUsers[i].code + " just disconnected")
          socketUsers.splice(i, 1)
        }
      }
      io.emit('players', socketUsers)
    })

    socket.on('join', function(id) {
      socket.join(id)
    })

    socket.on('leave', function(id) {
      socket.leave(id)
    })

    socket.on('lobby_join', function(data) {
      var exists = false
      for(var i = 0; i < socketUsers.length; i++ ){
        if(socketUsers[i].code === data.code){
          exists = true
        }
      }
      if(exists === false){
        console.log(data.code + " joins. mode: " + (data.observe ? '👁️' : '👤'))
        socketUsers.push({
          code: data.code,
          socket:socket.id,
          observe: data.observe
        })
      }
      io.emit('players', socketUsers)
    })

    socket.on('lobby_leave', function(data) {
      for(var i = 0; i < socketUsers.length; i++ ){
        if(socketUsers[i].code === data.code){
          console.log(data.code + " leaves")
          socketUsers.splice(i, 1)
        }
      }
      io.emit('players', socketUsers)
    })

    socket.on('data', function(data) { //data object emitter
      let id = data.id
      let item = {}

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
      })
    })
  })
}

module.exports = sockets