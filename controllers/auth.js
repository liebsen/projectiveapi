const jwt = require('jsonwebtoken')

const authToken = (req, res, next) => {
    const token = req.headers['authorization']
    if(typeof token !== 'undefined') {
        jwt.verify(token, process.env.APP_SECRET, function(err, decoded) {
            if(!err && decoded) {
                req.decoded = decoded
                next()
            } else {
                res.sendStatus(403)    
            }
        })    
    } else {
        //If header is undefined return Forbidden (403)
        res.sendStatus(403)
    }
}

module.exports = authToken