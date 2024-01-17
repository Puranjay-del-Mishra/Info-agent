const {
    startConversation,
    getConversationOutput,
    getConversationList,
    getConversationMessages
} = require("/Users/puranjaymishra/Documents/petavue/info-agent/src/controllers/conversation.controller.js")

const convRouter = require("express").Router()

convRouter.post("/start", startConversation)
convRouter.get("/output/:messageId", getConversationOutput)
convRouter.get("/list", getConversationList)
convRouter.get("/messages/:conversationId", getConversationMessages)

module.exports = convRouter