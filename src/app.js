const express = require('express')
const convRouter = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/routes/conversation.routes.js');
const router  = express.Router()
const app = express();
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

router.use('/conversation', convRouter)
app.use('/api/info/agent', router)

app.all("*", (req, res) =>{
    res.status(404).json({
        success: false,
        message: `Can't find ${req.originalUrl} on this server`
    })
})

module.exports = app