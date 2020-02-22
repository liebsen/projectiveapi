const path = require("path")
const bson = require('bson')

module.exports = {
  getById:  (req, res) => {
    req.app.db.collection('projects').aggregate(
      { $match : {
         "tasks.issues.id": req.params.id
      }},
      { $unwind : "$tasks" },
      { $unwind : "$tasks.issues" },
      { $match : {
         "tasks.issues.id": req.params.id
      }})
      .toArray(function(err,results){
        return res.json(results[0])
      }) 
  },
  deleteById:  (req, res) => {
    req.app.db.collection('projects').updateOne(
      {
        'tasks.issues.id': req.params.id
      },
      {
        "$pull": { "tasks.$.issues": { id: req.params.id} }
      },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error: ' + err
        })
      }
    })  
  },
  create: (req, res) => {
    let id = new bson.ObjectID().toString()
    let $push_query = []

    $push_query.push({
      id: new bson.ObjectID().toString(),
      title: req.body.title,
      text: req.body.text,
      owner: req.decoded.id
    })

    req.app.db.collection('projects').findOneAndUpdate(
    {
      'tasks.id': req.params.task_id
    },
    {
      "$push": { "tasks.$.issues": { "$each" : $push_query } }
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
      "$set": { "tasks.$.extra" : req.body }
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
  }
}