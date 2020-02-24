const jwt = require('jsonwebtoken')
const moment = require('moment')
var ObjectId = require('mongodb').ObjectId
let socketUsers = {}

let sockets = (io, db) => {

  io.on('connection', function(socket){

    const id = socket.handshake.query.token

    if(id && !socketUsers[id]){
      console.log("--catch: " + id)
      db.collection('accounts').find(
      {
        _id : new ObjectId(id)
      })
      .project({
        _id:0,
        name: 1,
        email: 1
      })
      .toArray(function(err,results){
        socketUsers[id] = {
          name: results[0].name,
          email: results[0].email,
          socket_id: socket.id
        }
        io.emit('users', socketUsers)
      }) 
    }

    socket.on('disconnect', function() {
      console.log("--disconnect: " + socket.id)

      for(var i in socketUsers){
        if(socketUsers[i].socket_id === socket.id){
          delete socketUsers[i]
        }
      }

      console.log(socketUsers)
      io.emit('users', socketUsers)
    })

    socket.on('login', function(id) {
      if(!socketUsers[id]){
        console.log("--login: " + id)
        db.collection('accounts').find(
        {
          _id : new ObjectId(id)
        })
        .project({
          _id:0,
          name: 1,
          email: 1
        })
        .toArray(function(err,results){
          socketUsers[id] = {
            name: results[0].name,
            email: results[0].email,
            socket_id: socket.id
          }
          console.log(socketUsers)
          io.emit('users', socketUsers)
        }) 
      }
    })

    socket.on('logout', function(id) {
      for(var i in socketUsers){
        if(i === id){
          delete socketUsers[i]
        }
      }

      console.log("--logout: " + id)
      console.log(socketUsers)
      io.emit('users', socketUsers)
    })

    socket.on('leave', function(data) {
      //console.log("leave:" + data)
      socket.leave(data.id)
      io.to(data.id).emit("user_leaves", data.name)
    })

    socket.on('join', function(data) {
      //console.log("join:" + data)
      socket.join(data.id)
      io.to(data.id).emit("user_joins", data.name)
    })

    socket.on('send', function(data) { //data object emitter
      //console.log("send: " + JSON.stringify(data))
      let $push_query = []
      const $created = moment().format()

      $push_query.push({
        sender: data.sender,
        name: data.name,
        line: data.line,
        created: $created
      })

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
        io.emit('notification', {
          id: doc.value._id,
          room: data.room,
          sender: data.sender
        })

        var accounts = doc.value.accounts
        accounts = accounts.filter(a => a.id != new ObjectId(data.sender))
        const ids = accounts.map(a => new ObjectId(a.id))

        $push_query = []
        $push_query.push({
          sender: data.sender,
          room: data.room,
          created: $created,
          read: 0
        })

        db.collection('accounts').updateMany({
          "_id": { "$in": ids }
        },{
          "$push": { "notifications": { "$each" : $push_query } }
        }).then((doc) => {
          //console.log(doc.value)
        })

        
      }).catch(function(err){
        console.log('err: ' + err)
      })
    })
  })
}

module.exports = sockets