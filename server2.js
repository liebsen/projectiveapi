const fs = require('fs')
var express = require('express');
var bcrypt = require('bcrypt');
var bson = require('bson');
var path = require('path');
var axios = require('axios');
var app = express();
var cors = require('cors');
var http = require('http').Server(app);
var io = require('socket.io')(http, { origins: '*:*'});
var moment = require('moment');
var mongodb = require('mongodb');
var expressLayouts = require('express-ejs-layouts')
var bodyParser = require('body-parser')
var mercadopago = require ('mercadopago');
var onlinewhen = moment().utc().subtract(10, 'minutes')
var helper = require('./helper')
var emailHelper = require('./email/helper')
var emailClient = emailHelper()
var nodeMailer = require('nodemailer')
var jwt = require('jsonwebtoken')
var socketUsers = []
const tokenExpires = 86400 * 30 * 12 // 1 year
const saltRounds = 10;
const allowedOrigins = [
  'http://localhost:3000',
  'http://0.0.0.0:8000',
  'https://localhost:8080',
  'https://projective.herokuapp.com',
  'https://projectiveapi.herokuapp.com'
]

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ type: 'application/json' }))
app.set('views', path.join(__dirname, 'static'))
app.use(express.static(path.join(__dirname, 'static')))
app.set('view engine', 'ejs')
app.use(expressLayouts)

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  //res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  //res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
  next();
})

app.use(cors({
  origin: function(origin, callback){
    // allow requests with no origin 
    // (like mobile apps or curl requests)
    if(!origin) {
      console.log("not allowed origin to unknown")
      return callback(null, true)
    }
    if(allowedOrigins.indexOf(origin) === -1){
      var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.'
      return callback(new Error(msg), false)
    }
    return callback(null, true)
  }
}))

mongodb.MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true, useNewUrlParser: true }, function(err, database) {
  if(err) throw err

  const db = database.db(process.env.MONGO_URL.split('/').reverse()[0])

  app.post('/contact', function (req, res) {  
    emailClient.send({
      to:process.env.EMAIL_PRIMARY, 
      subject:'Contacto desde FletsApp',
      data:{
        title:'Contacto desde FletsApp',
        message: 'Nombre: ' + req.body.first_name + '<br>Apellido : ' + req.body.last_name + '<br>Email: ' + req.body.email + '<br>Teléfono: ' + req.body.phone + '<br>Comentarios: ' + req.body.comment + '<br>'
        //link: process.env.APP_URL + '/contact/' + notification.value.external_reference,
        //linkText:'Ver detalle del envío'
      },
      templatePath:path.join(__dirname,'/email/template.html')
    }).then(function(){
      res.json({
        status: 'success'
      })
    }).catch(function(err){
      if(err) console.log(err)
      res.json({
        status: 'error'
      })
    })    
  })

  app.post('/account/login', (req, res) => {
    var email = req.body.email.toLowerCase()
    var password = req.body.password
    db.collection('accounts').findOne({
      email: email
    },function(err, user) {
      if (err) return res.status(500).send('Error on the server.');
      if (!user) return res.status(404).send('No user found.');
      let passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null });
      let token = jwt.sign({ id: user._id }, process.env.APP_SECRET, {
          expiresIn: tokenExpires // expires in 24 hours
      });
      res.status(200).send({ auth: true, token: token, user: user });
    })
  })

  app.post('/account/create', function (req, res) {  
    var email = req.body.email
    var password = req.body.password
    var name = req.body.name
    var code = req.body.code
    var validation_code = new bson.ObjectID().toString()
    console.log("email: " + email)

    db.collection('accounts').findOne({
      email: email
    },function(err, result) {
      if (err) return res.status(500).send('Error on the server.');
      if (result) return res.status(403).send('Email already in use.');

      bcrypt.hash(password, saltRounds, function (err, hash) {
        db.collection('accounts').findOneAndUpdate({
          code: code
        },
        {
          "$set": {
            code: null,
            email: email,
            password: hash,
            name: name,
            validated: false,
            validation_code: validation_code,
            validation_date: null,
            registration_date: moment().utc().format(),
            role: 'provider'
          }
        },{ 
          upsert: true, 
          'new': true, 
          returnOriginal:false 
        }).then(function(data) {    
          emailClient.send({
            to:email,
            subject: name + ', te damos la bienvenida a Projective.',
            data:{
              title:'Confirmá la creación de tu cuenta',
              message:'Hola ' + name + '! Por favor valida tu cuenta ahora para empezar a usar Projective',
              link: process.env.PANEL_URL + '/validate/' + validation_code,
              linkText:'Validar mi cuenta'
            },
            templatePath:path.join(__dirname,'/email/template.html')
          }).catch(function(err){
            if(err) console.log(err)
          }).then(function(){
            res.status(200).send({ status: 'success' });
          })
        }).catch((err) => {
          res.status(404).send('No code found.');
        }) 
      })
    })
  })

  app.post('/account/validate_code', function (req, res) {  
    db.collection('accounts').findOne({
      code: req.body.code
    },function(err, result) {
      if (err) return res.status(500).send('Error on the server.');
      if (!result) return res.status(404).send('No code found.');
      return res.status(200).send({status:'success'})
    })
  })

  app.post('/account/validate', function (req, res) {  
    db.collection('accounts').findOneAndUpdate({
      validation_code: req.body.code
    },
    {
      "$set": {
        validation_code:null,
        validated: true,
        validation_date: moment().utc().format()
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(user) {  
      let token = jwt.sign({ id: user._id }, process.env.APP_SECRET, {
          expiresIn: tokenExpires // expires in 24 hours
      });
      res.status(200).send({ auth: true, token: token, user: user });
    }).catch(function(err){
      if(err) return res.status(500).send("There was a problem getting user " + err)
    })
  })

  app.post('/data', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId; 
    db.collection('accounts').find({
      '_id': new ObjectId(req.decoded.id)
    })
    .limit(1)
    .toArray(function(err,results){
      return res.json({
        status: 'success',
        data:results[0]
      })
    })   
  })

  app.get('/projects', checkToken, function (req, res) { 
    db.collection('projects').find(
      {
        accounts: { id : req.decoded.id } 
      })
      .sort({_id:-1})
      .limit(1000)
      .skip(0)
      .toArray(function(err,results){
        return res.json(results)
      })  
  })

  app.get('/project/:id', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId
    db.collection('projects').find(
      {
        _id: new ObjectId(req.params.id)
      })
      .toArray(function(err,results){
        return res.json(results[0])
      })  
  })

  app.delete('/project/:id', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId
    db.collection('projects').deleteOne(
      {
        _id: new ObjectId(req.params.id)
      })
      .then(result => res.json({status:'deleted'}))
      .catch(err => console.error(`Delete failed with error: ${err}`))
  })


  // gets a milestone
  app.get('/milestone/:id', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId
    db.collection('projects').aggregate(
      { $match : {
         "milestones.id": req.params.id
      }},
      { $unwind : "$milestones" },
      { $match : {
         "milestones.id": req.params.id
      }},{ $group: { "milestones.id": req.params.id, count: { $sum: 1 } } })
      .toArray(function(err,results){
        console.log(req.params.id)
        console.log(results[0])
        return res.json(results[0])
      })  
  })

  app.delete('/milestone/:id', checkToken, function (req, res) { 
    db.collection('projects').updateOne(
      {
        'milestones.id': req.params.id
      },
      {
        "$pull": { milestones: { id: req.params.id} }
      },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error'
        })
      }
    })  
  })

  // creates a milestone
  app.put('/milestones/:project_id', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId;
    let inputs = req.body.milestones.split("\n")
    let $push_query = []

    inputs.forEach(milestone => {
      if(milestone.length){
        $push_query.push({
          id: new bson.ObjectID().toString(),
          title: milestone,
          owner: req.decoded.id
        })
      }
    })

    db.collection('projects').findOneAndUpdate(
    {
      '_id': new ObjectId(req.params.project_id)
    },
    {
      "$push": { milestones: { "$each" : $push_query } }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error'
        })
      }
    })  
  })

  // updates a milestone
  app.post('/milestones/:id', checkToken, function (req, res) { 
    db.collection('projects').updateOne(
    {
      'milestones.id': req.params.id
    },
    {
      "$set": { "milestones.$.extra" : req.body }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error'
        })
      }
    })  
  })

  // gets an issue
  app.get('/issues/:id', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId
    db.collection('projects').aggregate(
      { $match : {
         "milestones.issues.id": req.params.id
      }},
      { $unwind : "$milestones" },
      { $unwind : "$milestones.issues" },
      { $match : {
         "milestones.issues.id": req.params.id
      }})
      .toArray(function(err,results){
        return res.json(results[0])
      })  
  })

  // creates a project
  app.put('/project', checkToken, function (req, res) { 
    req.body.owner = req.decoded.id
    req.body.accounts = []
    req.body.accounts.push({
      id: req.decoded.id
    })
    db.collection('projects').insertOne(req.body, function (error, response) {
      if(error) {
        console.log('Error occurred while inserting');
      } else {
        return res.json(response.ops[0])
      }
    })
  })

  // updates a project
  app.post('/project', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId; 
    db.collection('projects').findOneAndUpdate({
      '_id': new ObjectId(req.body._id)
    },{
      "$set": req.body
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    });
  })

  // creates an issue
  app.put('/issues/:milestone_id', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId;
    let title = req.body.title
    let text = req.body.text
    let id = new bson.ObjectID().toString()
    let $push_query = []

    $push_query.push({
      id: new bson.ObjectID().toString(),
      title: title,
      text: text,
      owner: req.decoded.id
    })

    db.collection('projects').findOneAndUpdate(
    {
      'milestones.id': req.params.milestone_id
    },
    {
      "$push": { "milestones.$.issues": { "$each" : $push_query } }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error'
        })
      }
    })  
  })

  app.get('/', function (req, res) {
    res.render('index')
  })

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

  var server = http.listen(process.env.PORT||3000, function () { //run http and web socket server
    var host = server.address().address;
    var port = server.address().port;
    console.log('Server listening at address ' + host + ', port ' + port);
  });
});

//Check to make sure header is not undefined, if so, return Forbidden (403)
const checkToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if(typeof token !== 'undefined') {
    jwt.verify(token, process.env.APP_SECRET, function(err, decoded) {
      if(!err && decoded) {
        req.decoded = decoded
        next();
      } else {
        res.sendStatus(403)    
      }
    })    
  } else {
    //If header is undefined return Forbidden (403)
    res.sendStatus(403)
  }
}
