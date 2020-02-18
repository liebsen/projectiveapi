const path = require("path");
var ObjectId = require('mongodb').ObjectId

function flattenArray(data) {
  // our initial value this time is a blank array
  const initialValue = [];

  // call reduce on our data
  return data.reduce((total, value) => {
    // if the value is an array then recursively call reduce
    // if the value is not an array then just concat our value
    return total.concat(Array.isArray(value) ? flattenArray(value) : value);
  }, initialValue);
}

module.exports = {
 	getUsers: (req, res) => {
	    req.app.db.collection('projects').find(
			{
				accounts: { id : req.decoded.id } 
			}).toArray(function(err,results){

				var ids = flattenArray(results.map(item => item.accounts.map( account => {
					return account.id
				})))

				ids = ids.filter((value,index,self) => {
					return value && self.indexOf(value) === index
				})

				ids = ids.map(item => ObjectId(item))

				req.app.db.collection('accounts').find(
					{
						_id: { $in : ids } 
					})
					.project({
						email:1,
						name:1
					})
					.toArray(function(err,results2){
						return res.json(results2)
					})  
			})
	},
	search: (req, res) => {
		req.app.db.collection('accounts').find(
		{
			name: new RegExp(req.body.text, 'i'),
			_id : { $ne : new ObjectId(req.decoded.id) } 
		})
		.project({password:0})
		.toArray(function(err,results){
			return res.json(results)
		}) 
	},
	searchInProject: (req, res) => {
	    req.app.db.collection('projects').find(
			{
				'tasks.id': req.body.id
			}).toArray(function(err,results){
				var ids = flattenArray(results.map(item => item.accounts.map( account => {
					return account.id
				})))

				ids = ids.filter((value,index,self) => {
					return value && self.indexOf(value) === index
				})

				ids = ids.map(item => ObjectId(item))

				req.app.db.collection('accounts').find(
					{
						name: new RegExp(req.body.text, 'i'),
						_id: { $in : ids } 
					})
					.project({
						email:1,
						name:1
					})
					.toArray(function(err,results2){
						return res.json(results2)
					})  
			})
	}
}