const fs = require('fs')
var express = require('express');
var bcrypt = require('bcrypt');
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
const tokenExpires = 86400 * 30 * 12 // 1 year
const saltRounds = 10;
const allowedOrigins = [
  'http://localhost:4000',
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
      console.log("not allowed origin")
      console.log(origin)
      return callback(new Error(msg), false)
    }
    return callback(null, true)
  }
}))

/*
mercadopago.configure({
  //sandbox: true,
  //access_token: process.env.MP_TOKEN_TEST
  access_token: process.env.MP_TOKEN
})
*/


var random_code = function (factor){ 
  return Math.random().toString(36).substring(2, factor) + Math.random().toString(36).substring(2, factor)
}

mongodb.MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true, useNewUrlParser: true }, function(err, database) {
  if(err) throw err

  const db = database.db(process.env.MONGO_URL.split('/').reverse()[0])

  app.post('/flet/estimate/:movil', function (req, res) {  

    // unique user hardcode settings
    // calculo manual de cotizacion
    // todo : hacerlo dinamico para plataforma

    if(!req.body.ruta.distance || !req.params.movil || !req.body.carga.peso) 
      return res.json({status:'error',message:'Sin parámetros suficientes'})

    req.body.movil = req.params.movil 

    var ObjectId = require('mongodb').ObjectId; 
    db.collection('accounts').find({
      '_id': new ObjectId(req.params.movil)
    }).toArray(function(err, results) {
      if(!results[0]) return res.json({status:'error',message:'Falta código del sender.'})
      const preference =  results[0].settings
      // todo: refactor cost feature vector
      // ie: price + (value - basic) * karma

      // distance
      let distance = Math.round(req.body.ruta.distance.value/1000) // in km
      var delta = distance - parseFloat(preference.route.min,10);

      if(delta < 0){
        delta = 0;
      }

      let dpart = parseFloat(preference.route.price) + delta * parseFloat(preference.route.karma,10);

      // weight 
      delta = req.body.carga.peso - parseFloat(preference.cargo.min,10);

      if(delta < 0){
        delta = 0;
      }

      let service = req.body.carga.service ? parseFloat(preference.cargo.service,10) : 0
      let wpart = parseFloat(preference.cargo.price,10) + delta * parseFloat(preference.cargo.karma,10);
      let amount = parseFloat(Math.round(dpart + wpart) + service).toFixed(2);

      const estimate = {
        amount: parseInt(amount),
        //amount: 10.00,
        currency: 'ARS'
      }

      req.body.estimate = estimate
      req.body.createdAt = moment().utc().format()

      db.collection('preferences').insertOne(req.body, function(err,doc){
        let data = {
          id: doc.insertedId,

          status: 'success',
          estimate: estimate
        }

        return res.json(data)
      })
    })
  })

  app.post('/flet/preference', function (req, res) {  
    // Crea un objeto de preferencia
    var ObjectId = require('mongodb').ObjectId; 
    db.collection('preferences').find({
      '_id': new ObjectId(req.body.id)
    }).toArray(function(err, results) {
      if(results.length && results[0].estimate.amount){
        let preference = {
          items: [
            {
              id: req.body.id,
              title: 'Envío con FletsApp',
              description: "",
              unit_price: parseFloat(results[0].estimate.amount),
              currency_id: "ARS",
              quantity: 1
            }
          ],
          notification_url: req.protocol + '://' + req.get('host') + "/mercadopago/notification",
          external_reference: req.body.id
        };

        mercadopago.preferences.create(preference).then(function(response){
          return res.json(response.body)
        }).catch(function(error){
          console.log("mercadopago error: ");
          console.log(error);
        })
      } else {
        return res.json({
          status: 'error'
        })
      }
    })
  })

  app.post('/mercadopago/notification', function (req, res) { 
    if(req.body.data){
      axios.get('https://api.mercadopago.com/v1/payments/' + req.body.data.id + '?access_token=' + process.env.MP_TOKEN, {} ).then((response) => {
        // check if notification exists
        var ObjectId = require('mongodb').ObjectId; 
        db.collection('preferences').findOneAndUpdate(
        {
          '_id': new ObjectId(response.data.external_reference)
        },
        {
          "$set": {
            mercadopago : response.data
          }
        },{ 
          upsert: true, 
          'new': true, 
          returnOriginal:false 
        }).then(function(preference){
          if(preference.value.mercadopago.status === 'approved'){
            emailClient.send({
              to:process.env.EMAIL_PRIMARY,
              subject:'Tenés un envío de FletsApp',
              data:{
                title:'Marina: Te salió un envío!',
                message: 'Nombre: ' + preference.value.datos.nombre + '<br>Teléfono : ' + preference.value.datos.telefono + '<br>Pasar a buscar en: ' + preference.value.ruta.from.formatted_address + '<br>Entregar en : ' + preference.value.ruta.to.formatted_address + '<br>',
                link: process.env.APP_URL + '/envio/' + preference.value.mercadopago.external_reference,
                linkText:'Ver detalle del envío'
              },
              templatePath:path.join(__dirname,'/email/template.html')
            }).then(function(){
              res.sendStatus(200)
            }).catch(function(err){
              if(err) console.log(err)
              res.sendStatus(200)
            })
          }
        }).catch((err) => {
          return res.json(err)
        })
      })
    } else {
     res.sendStatus(200)
    }
  })  

  app.post('/procesar-pago', function (req, res) { 
    res.redirect(process.env.APP_URL + '/pago-completado/' + req.body.payment_status)
  })

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

  app.post('/flet/directions', function (req, res) {  
    axios.get( 'https://maps.googleapis.com/maps/api/directions/json?origin=' + req.body.from.lat + ',' + req.body.from.lng + '&destination=' + req.body.to.lat + ',' + req.body.to.lng + '&avoid=tolls&mode=driving&key=' + process.env.API_KEY, {} ).then((response) => {
      return res.json(response.data)
    }).catch((err) => {
      return res.json(err)
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
    var validation_code = random_code(32)

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
            subject: name + ', te damos la bienvenida a FletsPanel.',
            data:{
              title:'Confirmá la creación de tu cuenta',
              message:'Hola ' + name + '! Por favor valida tu cuenta ahora para empezar a usar FletsPanel',
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

  app.post('/panel/search', checkToken, function (req, res) { 
    if(!req.body) return res.json({'error':'not_enough_params'})
    var body = JSON.parse(req.body.data)
    , limit = parseInt(body.limit)||50
    , skip = parseInt(body.skip)||0
    , find = body.find || {}
    , sort = body.sort || {_id:-1}
    db.collection('preferences').countDocuments(find, function(error, numOfResults){
      db.collection('preferences').find(find)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .toArray(function(err,results){
          res.json({
            count:numOfResults,
            results:results            
          })
        })   
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

  app.post('/settings', checkToken, function (req, res) { 
    var ObjectId = require('mongodb').ObjectId;
    db.collection('accounts').findOneAndUpdate(
    {
      '_id': new ObjectId(req.decoded.id)
    },
    {
      "$set": {
        settings : req.body
      }
    }).then(function(){
      return res.json({
        status: 'success'
      })
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error'
        })
      }
    })   
  })

  app.post('/panel/charts', checkToken, function (req, res) { 
    var types = { week : 4, month : 6 } 
    , data = {}
    , max = 0

    db.collection('preferences').find({})
      .sort({_id:-1})
      .limit(1000)
      .skip(0)
      .toArray(function(err,results){
        results.forEach((item) => {
          for(var j in types){
            for(var i = 0; i < types[j]; i++ ){
              var date = moment.utc(item.createdAt,'YYYY-MM-DD');
              if(helper.isPeriod(date,i,j)){
                if(!data[j]) data[j] = {}
                if(!data[j][i]) data[j][i] = {
                  preferences: 0,
                  approved: 0
                }
                data[j][i].preferences++

                if(max < data[j][i].preferences){
                  max = data[j][i].preferences
                }

                if(item.mercadopago){
                  if(!data[j][i][item.mercadopago.status]) 
                    data[j][i][item.mercadopago.status] = 0
                  data[j][i][item.mercadopago.status]++
                }
              } 
            }
          }
        })

        return res.json({
          max: max,
          data: data
        })
      })  
      // ./ 
  })


  app.post('/panel/list', function (req, res) { 
    var data = {}
    , type = req.body.type
    , view = req.body.view
    , period = req.body.period
    , from = null
    , to = null

    if(period>0){
      from = moment().subtract(period,view + (period>1?'s':'')).utc().startOf(view)
      to = moment().subtract(period,view + (period>1?'s':'')).utc().endOf(view)
    } else {
      from = moment().utc().startOf(view),
      to = moment().utc().endOf(view)
    }
    
    var find = {
      "createdAt": {
        $gte: from.format(),
        $lt: to.format()
      }
    }

    if(type != 'preferences'){
      find['mercadopago.status'] = type
    }

    db.collection('preferences').find(find)
      .sort({_id:-1})
      .limit(1000)
      .skip(0)
      .toArray(function(err,data){
        return res.json({
          data: data
        })
      })  
      // ./ 
  })

  app.post('/preference', checkToken, function (req, res) { 
    if(!req.body) return res.json({'error':'not_enough_params'})
    var ObjectId = require('mongodb').ObjectId; 
    db.collection('preferences').find({
      '_id': new ObjectId(req.body.id)
    }).toArray(function(err, results) {
      if (err) return res.status(500).send('Error on the server.');
      if (!results[0]) return res.status(404).send('No preference found.');
      res.json({ status:'success',preference: results[0] });
    })
  })

  app.get('/', function (req, res) {
    res.render('index')
  })

  io.on('connection', function(socket){ //join room on connect

    socket.on('disconnect', function() {
      console.log("disconnect")
      for(var i = 0; i < playersIdle.length; i++ ){
        if(playersIdle[i].socket === socket.id){
          console.log(playersIdle[i].code + " just disconnected")
          playersIdle.splice(i, 1)
        }
      }
      io.emit('players', playersIdle)
    })

    socket.on('join', function(id) {
      socket.join(id)
    })

    socket.on('leave', function(id) {
      socket.leave(id)
    })


    socket.on('lobby_join', function(data) {
      var exists = false
      for(var i = 0; i < playersIdle.length; i++ ){
        if(playersIdle[i].code === data.code){
          exists = true
        }
      }
      if(exists === false){
        console.log(data.code + " joins. mode: " + (data.observe ? '👁️' : '👤'))
        playersIdle.push({
          code: data.code,
          socket:socket.id,
          observe: data.observe
        })
      }
      io.emit('players', playersIdle)
    })

    socket.on('lobby_leave', function(data) {
      for(var i = 0; i < playersIdle.length; i++ ){
        if(playersIdle[i].code === data.code){
          console.log(data.code + " leaves")
          playersIdle.splice(i, 1)
        }
      }
      io.emit('players', playersIdle)
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

  var server = http.listen(process.env.PORT, function () { //run http and web socket server
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
