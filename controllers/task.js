const path = require("path");


const getById = (req, res) => {
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
        console.log(req.params.id)
        console.log(results[0])
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
// creates a task

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

    req.app.db.collection('projects').findOneAndUpdate(
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
}

// updates a task
const update = (req, res) => {
    req.app.db.collection('projects').updateOne(
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
}

module.exports = {
  getById: getById,
  deleteById: deleteById,
  create: create,
  update: update
}