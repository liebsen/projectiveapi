const path = require("path")
const emailHelper = require('../email/helper')
const emailClient = emailHelper()

const contact = (req, res) => {
    emailClient.send({
      to:process.env.EMAIL_PRIMARY, 
      subject:'Contacto desde Projective',
      data:{
        title:'Contacto desde Projective',
        message: 'Nombre: ' + req.body.first_name + '<br>Apellido : ' + req.body.last_name + '<br>Email: ' + req.body.email + '<br>Teléfono: ' + req.body.phone + '<br>Comentarios: ' + req.body.comment + '<br>'
        //link: process.env.APP_URL + '/contact/' + notification.value.external_reference,
        //linkText:'Ver detalle del envío'
      },
      templatePath:path.join(__dirname,'/email/template.html')
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
}

module.exports = {
  contact: contact
}