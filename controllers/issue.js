const path = require("path")
const bson = require('bson')

const getById = (req, res) => {
  db.collection('projects').aggregate(
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
}

const deleteById = (req, res) => {
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
}

const create = (req, res) => {
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
}

// updates a task
const update = (req, res) => {
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

module.exports = {
  getById: getById,
  deleteById: deleteById,
  create: create,
  update: update
}