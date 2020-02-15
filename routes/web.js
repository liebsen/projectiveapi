const express = require("express")
const router = express.Router()
const homeController = require("../controllers/home")
const contactController = require("./../controllers/contact")
const authToken = require("./../controllers/auth")
const accountController = require("./../controllers/account")
const uploadController = require("./../controllers/upload")
const projectController = require("./../controllers/project")
const taskController = require("./../controllers/task")
const issueController = require("./../controllers/issue")

let routes = (app, db) => {

	router.get("/", homeController.getHome)

	router.post('/contact', contactController.contact)

	router.post('/account/login', accountController.login)
	router.post('/account/create', accountController.create)
	router.post('/account/validate_code', accountController.validate_code)
	router.post('/account/validate', accountController.validate)
	router.post('/account/data', authToken, accountController.data)

	router.get('/projects', authToken, projectController.getOwned)
	router.get('/project/:id', authToken, projectController.getById)
	router.delete('/project/:id', authToken, projectController.deleteById)
	router.put('/project', authToken, projectController.create)
	router.post('/project', authToken, projectController.update)

	router.get('/task/:id', authToken, taskController.getById)
	router.delete('/task/:id', authToken, taskController.deleteById)
	router.put('/task/:project_id', authToken, taskController.create)
	router.post('/task/:id', authToken, taskController.update)

	router.get('/issue/:id', authToken, issueController.getById)
	router.put('/issue/:task_id', authToken, issueController.create)
  
	router.post('/multiple-upload',uploadController.uploadImages,uploadController.resizeImages,uploadController.getResult)

	return app.use('/', router)
}

module.exports = routes