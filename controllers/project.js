const path = require("path")
const bson = require('bson')

const getOwned = (req, res) => {
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
}

const getById = (req, res) => {
    var ObjectId = require('mongodb').ObjectId
    req.app.db.collection('projects').find(
      {
        _id: new ObjectId(req.params.id)
      })
      .toArray(function(err,results){
        return res.json(results[0])
      })  
}

const deleteById = (req, res) => {
    var ObjectId = require('mongodb').ObjectId
    req.app.db.collection('projects').deleteOne(
      {
        _id: new ObjectId(req.params.id)
      })
      .then(result => res.json({status:'deleted'}))
      .catch(err => console.error(`Delete failed with error: ${err}`))
}

const create = (req, res) => {
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
}

const update = (req, res) => {
    var ObjectId = require('mongodb').ObjectId; 
    req.app.db.collection('projects').findOneAndUpdate({
      '_id': new ObjectId(req.body._id)
    },{
      "$set": req.body
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    })
}

module.exports = {
  getOwned: getOwned,
  getById: getById,
  deleteById: deleteById,
  create: create,
  update: update
};