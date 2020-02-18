const path = require("path")
const jwt = require('jsonwebtoken')
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
      if (err) return res.status(500).send('Error on the server.');
      if (!user) return res.status(404).send('No user found.');
      let passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null });
      let token = jwt.sign({ id: user._id }, process.env.APP_SECRET, {
          expiresIn: tokenExpires // expires in 24 hours
      });
      res.status(200).send({ auth: true, token: token, user: user });
    })
  },
  create: (req, res) => {
    var email = req.body.email
    var password = req.body.password
    var name = req.body.name
    var code = req.body.code
    var validation_code = new bson.ObjectID().toString()
    console.log("email: " + email)

    req.app.db.collection('accounts').findOne({
      email: email
    },function(err, result) {
      if (err) return res.status(500).send('Error on the server.');
      if (result) return res.status(403).send('Email already in use.');

      bcrypt.hash(password, saltRounds, function (err, hash) {
        req.app.db.collection('accounts').findOneAndUpdate({
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
              link: process.env.API_URL + '/validate/' + validation_code,
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
  }
}