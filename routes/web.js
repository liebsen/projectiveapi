const express = require("express")
const router = express.Router()
const homeController = require("../controllers/home")
const contactController = require("./../controllers/contact")
const authToken = require("./../controllers/auth")
const accountController = require("./../controllers/account")
const uploadController = require("./../controllers/upload")
const userController = require("./../controllers/user")
const projectController = require("./../controllers/project")
const taskController = require("./../controllers/task")
const issueController = require("./../controllers/issue")

let routes = (app, db) => {

	router.get("/", homeController.getHome)

	router.post('/contact', contactController.contact)

	router.post('/account/login', accountController.login)
	router.post('/account/create', accountController.create)
	router.post('/account/validate_code', accountController.validate_code)
	router.post('/account/validate/:code', accountController.validate)
	router.post('/account/data', authToken, accountController.data)
	router.get('/account/notifications', authToken,accountController.getNotifications)
	router.get('/account/notifications/count', authToken,accountController.getNotificationsCount)
	router.get('/account/:id', authToken,accountController.getById)

	router.get('/users', authToken, userController.getUsers)
	router.post('/users/search', authToken, userController.search)
	router.post('/users/search/project', authToken, userController.searchInProject)

	router.get('/projects', authToken, projectController.getOwned)
	router.get('/projects_ids', authToken, projectController.getOwnedIds)
	router.get('/project/:id', authToken, projectController.getById)
	router.delete('/project/:id', authToken, projectController.deleteById)
	router.put('/project', authToken, projectController.create)
	router.post('/project', authToken, projectController.update)
	router.post('/project/share', authToken, projectController.share)

	router.post('/task/share', authToken, taskController.share)
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