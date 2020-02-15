const express = require("express")
const app = express()
const http = require('http').Server(app)
const initRoutes = require("./routes/web")
const initSockets = require("./routes/socket")
const bodyParser = require('body-parser')
const mongodb = require('mongodb')
const cors = require('cors')
const io = require('socket.io')(http, { origins: '*:*'})
const allowedOrigins = [
	'http://localhost:3000',
	'http://0.0.0.0:8000',
	'https://localhost:8080',
	'https://projective.herokuapp.com',
	'https://projectiveapi.herokuapp.com'
]

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(express.urlencoded({ extended: true }))
app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*") // update to match the domain you will make the request from
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
	next()
})

app.use(cors({
	origin: function(origin, callback){
		// allow requests with no origin 
		// (like mobile apps or curl requests)
		if(!origin) {
			console.log("not allowed origin to unknown")
			return callback(null, true)
		}
		if(allowedOrigins.indexOf(origin) === -1){
			var msg = 'The CORS policy for this site does not ' +
				'allow access from the specified Origin.'
			return callback(new Error(msg), false)
		}
		return callback(null, true)
	}
}))

mongodb.MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true, useNewUrlParser: true }, function(err, database) {
	if(err) throw err
	const db = database.db(process.env.MONGO_URL.split('/').reverse()[0])
	app.db = db

	initRoutes(app)
	initSockets(io, db)

	http.listen(process.env.PORT||3000, () => {
	  console.log(`Server running at localhost:${port}`)
	})
})
