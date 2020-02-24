const path = require("path")
const bson = require('bson')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const bcrypt = require('bcrypt')
const tokenExpires = 86400 * 30 * 12 // 1 year
const saltRounds = 10
var ObjectId = require('mongodb').ObjectId

module.exports = {
  login: (req, res) => {

    var email = req.body.email.toLowerCase()
    var password = req.body.password
    req.app.db.collection('accounts').findOne({
      email: email
    },function(err, user) {
      if (err) return res.status(500).send('Error on the server.')
      if (!user) return res.status(404).send('No user found.')
      let passwordIsValid = bcrypt.compareSync(req.body.password, user.password)
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })
      let token = jwt.sign({ id: user._id }, process.env.APP_SECRET, {
        expiresIn: tokenExpires
      })
      res.status(200).send({ auth: true, token: token, user: user })
    })
  },
  create: (req, res) => {
    var password = req.body.password
    var name = req.body.name
    var validation_code = new bson.ObjectID().toString()

    bcrypt.hash(password, saltRounds, function (err, hash) {
      req.app.db.collection('accounts').findOneAndUpdate({
        code: req.body.code
      },
      {
        "$set": {
          code: null,
          password: hash,
          name: name,
          validated: false,
          validation_code: validation_code,
          validation_date: null,
          registration_date: moment().utc().format(),
          role: 'account'
        }
      },{ 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(data) {   
        return emailClient.send({
          to:data.value.email,
          subject: name + ', te damos la bienvenida a Projective',
          data:{
            title:'Confirmá la creación de tu cuenta',
            message:'Hola ' + name + '! Validá tu cuenta ahora para empezar a usar Projective.',
            link: process.env.APP_URL + '/validate/' + validation_code,
            linkText:'Validar mi cuenta'
          },
          templatePath:path.join(__dirname,'/../email/template.html')
        }).catch(function(err){
          if(err) console.log(err)
        }).then(function(){
          res.status(200).send({ status: 'success' });
        })
      }).catch((err) => {
        res.status(404).send('No code found. ' + err);
      }) 
    })
  },
  validate_code: (req, res) => {
    req.app.db.collection('accounts').findOne({
      code: req.body.code
    },function(err, result) {
      if (err) return res.status(500).send('Error on the server.');
      if (!result) return res.status(404).send('No code found.');
      return res.status(200).send({status:'success'})
    })
  },
  validate: (req, res) => {
    req.app.db.collection('accounts').findOneAndUpdate({
      validation_code: req.params.code
    },
    {
      "$set": {
        validation_code: null,
        validated: true,
        validation_date: moment().utc().format()
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(user) {  
      let token = jwt.sign({ id: user.value._id }, process.env.APP_SECRET, {
        expiresIn: tokenExpires
      })
      res.status(200).send({ auth: true, token: token, user: user.value });
    }).catch(function(err){
      if(err) return res.status(500).send("There was a problem getting user " + err)
    })
  },
  data:  (req, res) => {
    req.app.db.collection('accounts').find({
      '_id': new ObjectId(req.decoded.id)
    })
    .limit(1)
    .toArray(function(err,results){
      return res.json({
        status: 'success',
        data:results[0]
      })
    })  
  },
  getById: (req, res) => {
    req.app.db.collection('accounts').find(
      {
        _id: new ObjectId(req.params.id)
      })
      .toArray(function(err,results){
        return res.json(results[0])
      }) 
  },
  getNotifications: (req, res) => {
    req.app.db.collection('accounts').findOneAndUpdate({
      _id: new ObjectId(req.decoded.id)
    },{
      "$set" : { "notifications.$[].read": 1 }
    },{ 
      'new': false, 
      returnOriginal:true 
    }).then(function(doc) {
      if (!doc.value) return res.status(404).send('Account might be deleted')

      let lastNotifications = doc.value.notifications.reverse()

      if(lastNotifications.length > 50){
        lastNotifications = lastNotifications.slice(0,50)
      }

      function findExtraData(item) {
        return new Promise((resolve, reject) => {
          req.app.db.collection('projects').findOne({"tasks.id": item.room}, function(err,doc) {
            req.app.db.collection('accounts').findOne({_id: new ObjectId(item.sender)}, function(err,doc2) {
              if (doc && doc.tasks) {
                resolve({
                  sender: doc2.name,
                  project: doc.title,
                  task: doc.tasks[0].title
                })
              } else {
                resolve(null)
              }
            })
          })
        })
      } 

      let promises = lastNotifications.map(element => {
        return findExtraData(element)
          .then(extra => {
            if (extra) {
              element.extra = extra
              return element
            }
            return false
          })
      })

      Promise.all(promises)
        .then(results => {
          return res.json(results)
        })
        .catch(e => {
          console.error(e)
        })     
    }) 
  },
  getNotificationsCount: (req, res) => {
    req.app.db.collection('accounts').findOne({
      _id: new ObjectId(req.decoded.id)
    },function(err, doc) {
      if (err) return res.status(500).send('Error on the server')
      if (!doc) return res.status(404).send('Account might be deleted')
      var filter = []
      if(doc.notifications){
        filter = doc.notifications.filter(item => !item.read)
      }
      return res.json({count:filter.length})
    })
  }
}