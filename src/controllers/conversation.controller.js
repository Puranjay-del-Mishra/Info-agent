const chat = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/services/chat/conversation.js')

const startConversation = async (req, res) => {
    try {
        const result = await chat.startConversation(
            req.body
        )
        res.send(result)
    } catch (err) {
        res.status(500).json({
            error: err.message,
            message: "Fail to start a conversation"
        })
    }
}

const getConversationOutput = async (req, res) => {
    try {
        const { messageId } = req.params
        const result = await chat.getConversationOutput(messageId)
        res.send(result)
    } catch (err) {
        res.status(500).json({
            error: err.message,
            message: "Fail to get conversation output"
        })
    }
}

const getConversationList = async (req, res) => {
    try {
        const params = req.query
        const result = await chat.getConversationList(params)
        res.send(result)
    } catch (err) {
        res.status(500).json({
            error: err.message,
            message: "Fail to get conversation list"
        })
    }
}

const getConversationMessages = async (req, res) => {
    try {
        const { conversationId } = req.params
        const result = await chat.getConversationMessages(conversationId)
        res.send(result)
    } catch (err) {
        res.status(500).json({
            error: err.message,
            message: "Fail to get conversation messages"
        })
    }
}

module.exports = {
    startConversation,
    getConversationOutput,
    getConversationList,
    getConversationMessages
}