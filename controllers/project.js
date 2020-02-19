const path = require("path")
const bson = require('bson')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
var ObjectId = require('mongodb').ObjectId

module.exports = {
  getOwned: (req, res) => {
    req.app.db.collection('projects').find(
      {
        accounts: { id : req.decoded.id } 
      })
      .sort({_id:-1})
      .limit(1000)
      .skip(0)
      .toArray(function(err,results){
        return res.json(results)
      })  
  },
  getById: (req, res) => {
    var ObjectId = require('mongodb').ObjectId
    req.app.db.collection('projects').find(
      {
        _id: new ObjectId(req.params.id)
      })
      .toArray(function(err,results){
        return res.json(results[0])
      })  
  },
  deleteById: (req, res) => {
    var ObjectId = require('mongodb').ObjectId
    req.app.db.collection('projects').deleteOne(
      {
        _id: new ObjectId(req.params.id)
      })
      .then(result => res.json({status:'deleted'}))
      .catch(err => console.error(`Delete failed with error: ${err}`))
  },
  create: (req, res) => {
    req.body.owner = req.decoded.id
    req.body.accounts = []
    req.body.accounts.push({
      id: req.decoded.id
    })
    req.app.db.collection('projects').insertOne(req.body, function (error, response) {
      if(error) {
        console.log('Error occurred while inserting');
      } else {
        return res.json(response.ops[0])
      }
    })
  },
  update: (req, res) => {
    const id = req.body._id
    delete req.body._id
    req.app.db.collection('projects').findOneAndUpdate({
      '_id': new ObjectId(id)
    },{
      "$set": req.body
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    })
  },
  share: (req, res) => {
    var $push_query = []

    if(req.body.exists){

      if(!req.body.user){
        return res.sendStatus(402)
      }

      $push_query.push({id:req.body.user._id})

      req.app.db.collection('projects').findOneAndUpdate(
      {
        '_id': new ObjectId(req.body.data._id)
      },
      {
        "$addToSet": { accounts: { "$each" : $push_query } }
      },{ 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(doc){
        return emailClient.send({
          to:req.body.user.email, 
          subject:'Proyective: Fuiste invitado a un proyecto',
          data:{
            title:'Fuiste invitado a un proyecto',
            message: 'Ahora podés ser parte del desarrollo de ' + req.body.data.title,
            link: process.env.APP_URL + '/login',
            linkText:'Iniciá sesión ahora'
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
      }).catch(function(err){
        if(err){
          return res.json({
            status: 'error: ' + err
          })
        }
      })
    } else {
      const code = new bson.ObjectID().toString()
      req.app.db.collection('accounts').findOne({
        email: req.body.data.email
      },function(err, result) {
        if(result){
          return res.sendStatus(403)
        } else {
          req.app.db.collection('accounts').insertOne({
            code:code,
            email: req.body.data.email,
            invited_by: req.decoded.id
          }, function (error, response) {
            if(error) {
              console.log('Error occurred while inserting');
            } else {

              $push_query.push({id:response.ops[0]._id.toString()})
              req.app.db.collection('projects').findOneAndUpdate(
              {
                '_id': new ObjectId(req.body.data._id)
              },
              {
                "$push": { accounts: { "$each" : $push_query } }
              },{ 
                upsert: true, 
                'new': true, 
                returnOriginal:false 
              }).then(function(doc){
                return emailClient.send({
                  to:req.body.data.email, 
                  subject:'Proyective: Fuiste invitado a un proyecto',
                  data:{
                    title:'Fuiste invitado a un proyecto',
                    message: 'Ahora podés ser parte del desarrollo de ' + req.body.data.title,
                    link: process.env.APP_URL + '/register/' + code,
                    linkText:'Registrate ahora'
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
      })
    }
  }
}