const path = require("path")
const bson = require('bson')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
var ObjectId = require('mongodb').ObjectId

module.exports = {
  getById: (req, res) => {
    var ObjectId = require('mongodb').ObjectId
    req.app.db.collection('projects').aggregate(
      { $match : {
         "tasks.id": req.params.id
      }},
      { $unwind : "$tasks" },
      { $match : {
         "tasks.id": req.params.id
      }},{ $group: { "tasks.id": req.params.id, count: { $sum: 1 } } })
      .toArray(function(err,results){
        return res.json(results[0])
      })  
  },
  deleteById: (req, res) => {
    req.app.db.collection('projects').updateOne(
      {
        'tasks.id': req.params.id
      },
      {
        "$pull": { tasks: { id: req.params.id} }
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
  },
  create:  (req, res) => {
    let inputs = req.body.tasks.split("\n")
    let $push_query = []

    inputs.forEach(task => {
      if(task.length){
        $push_query.push({
          id: new bson.ObjectID().toString(),
          title: task,
          owner: req.decoded.id
        })
      }
    })

    req.app.db.collection('projects').findOneAndUpdate(
    {
      '_id': new ObjectId(req.params.project_id)
    },
    {
      "$push": { tasks: { "$each" : $push_query } }
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
  },
  update: (req, res) => {
    req.app.db.collection('projects').updateOne(
    {
      'tasks.id': req.params.id
    },
    {
      "$set": { 
        "tasks.$.title": req.body.title,
        "tasks.$.extra" : req.body.extra
      }
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
  },
  share: (req, res) => {
    var $push_query = []
    $push_query.push({id:req.body.user._id})

    console.log("-----------")
    console.log(req.body.id)

    req.app.db.collection('projects').findOneAndUpdate(
    {
      'tasks.id': req.body.id
    },
    {
      "$push": { "tasks.$.managers": { "$each" : $push_query } }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return emailClient.send({
        to:req.body.user.email, 
        subject:'Proyective: Fuiste asignado a un proyecto',
        data:{
          title:'Fuiste asignado a un proyecto',
          message: 'Ahora podés ser parte del desarrollo de ' + req.body.title,
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
          status: 'error: ' + err
        })
      })
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error: ' + err
        })
      }
    })
  }
}