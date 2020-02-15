const path = require("path")
const bson = require('bson')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()

const search = (req, res) => {
  var ObjectId = require('mongodb').ObjectId
  req.app.db.collection('accounts').find(
    {
      name: new RegExp(req.body.text, 'i'),
      _id : { $ne : new ObjectId(req.decoded.id) } 
    })
    .sort({_id:-1})
    .limit(1000)
    .skip(0)
    .toArray(function(err,results){
      return res.json(results)
    }) 
}

const create = (req, res) => {
  var ObjectId = require('mongodb').ObjectId
  var $push_query = []
  const code = new bson.ObjectID().toString()
  $push_query.push(code)

  req.app.db.collection('accounts').insertOne({code:code}, function (error, response) {
    if(error) {
      console.log('Error occurred while inserting');
    } else {

      req.app.db.collection('projects').findOneAndUpdate(
      {
        '_id': new ObjectId(req.body._id)
      },
      {
        "$push": { accounts: { "$each" : $push_query } }
      },{ 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(doc){

          emailClient.send({
            to:req.body.email, 
            subject:'Proyective: ' + req.body.title,
            data:{
              title:'Fuiste asignado a un proyecto',
              message: 'Pulsá la siguiente URL para registrar tu cuenta ahora<br><a href="' + process.env.APP_URL + '/register/' + code +'">' + process.env.APP_URL + '/register/' + code + '</a>'
              //link: process.env.APP_URL + '/contact/' + notification.value.external_reference,
              //linkText:'Ver detalle del envío'
            },
            templatePath:path.join(__dirname,'/../email/template.html')
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


          return res.json(doc.value)
      }).catch(function(err){
        if(err){
          return res.json({
            status: 'error'
          })
        }
      })
    }
  })   
}

const assign = (req, res) => {
  var ObjectId = require('mongodb').ObjectId
  var $push_query = []
  $push_query.push(req.body._id)

  req.app.db.collection('projects').findOneAndUpdate(
  {
    '_id': new ObjectId(req.body._id)
  },
  {
    "$push": { accounts: { "$each" : $push_query } }
  },{ 
    upsert: true, 
    'new': true, 
    returnOriginal:false 
  }).then(function(doc){

    emailClient.send({
      to:req.body.email, 
      subject:'Proyective: ' + req.body.title,
      data:{
        title:'Fuiste asignado a un proyecto',
        message: 'Pulsá la siguiente URL para iniciar sesión con tu cuenta ahora<br><a href="' + process.env.APP_URL + '/login">' + process.env.APP_URL + '/login</a>'
        //link: process.env.APP_URL + '/contact/' + notification.value.external_reference,
        //linkText:'Ver detalle del envío'
      },
      templatePath:path.join(__dirname,'/../email/template.html')
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

    return res.json(doc.value)
  }).catch(function(err){
    if(err){
      return res.json({
        status: 'error: ' + err
      })
    }
  })
}

module.exports = {
  create: create,
  assign: assign,
  search: search
}