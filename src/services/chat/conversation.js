const mongoDB = require("/Users/puranjaymishra/Documents/petavue/info-agent/src/mongo.js")
const {ObjectId} = require('mongodb')
const {storeConv, autoIncrementStepIds, saveMessage, getPrevContext, fetchPrompt, queryEnricher} = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/services/chat/chat.utils.js')
const OpenAI = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/llms/openai.service.js')
const {getDataSources, getMetaData} = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/llms/metaData.service.js')
const { start } = require("repl")
const { message } = require("statuses")
const startConversation = async (body) => {
    console.log('///////////////////////////////////////////////////////////')
    // get the info agent prompt from the  db
    // get the necessary parts of the tables from the metadata (you need to make a new function for this)
    // call the  info agent using 3.5

    // console.log('Check one')
    const prompt = await fetchPrompt("InfoAgent")
    let messages_temp = []
    if (!body.conversationId) {
        body.conversationId = new ObjectId()
        body.mid = 1
        await storeConv(body)
    } else {
        body.conversationId = new ObjectId(body.conversationId)
        let { prevContext, lastMessageId } = await getPrevContext(body.conversationId)
        body.mid = lastMessageId + 1
        messages_temp = messages_temp.concat(...prevContext)
    }

    // const messageId = await saveMessage(body)
    // body.messageId = messageId

    messages_temp.push({
        role: "user",
        content: body.query
    })

    const dataSourcesList = await getDataSources(messages_temp)

    const metaDataInfo = await getMetaData(messages_temp, dataSourcesList)
    // console.log(metaDataInfo)
    
    metaDataInfo.forEach(element => {
        if(typeof element.DatasourceDescription === "undefined"){
            element.Datasource = ""
        }
    }); 
    body.metaDataInfo = metaDataInfo

    let messages = [
        {
            role: "system",
            content: `${prompt.body}\n [Meta] \n${JSON.stringify(body.metaDataInfo)}\n[/Meta]`
        }
    ]

    messages.push(...messages_temp) //adding the previous context from the messages_temp

    const printMessage = messages.slice(1)
    console.log('The messages that were used for the LLM call are-',printMessage)

    body.llm_resp = await startLLMConversation(body, messages, prompt.model)
    console.log('The response is- ', body.llm_resp.message.content)

    const messageId = await saveMessage(body)
    body.messageId = messageId

    return {
        success: true,
        message: "Starting the conversation...",
        conversationId: body.conversationId
    }
}


const startLLMConversation = async (body, messages, model) => {
    const resp = await OpenAI.chatCompletion({
        messages,
        toolName: "InfoAgent",
        model,
        meta: {
            stepId: 0,
            messageId: body.messageId,
            conversationId: body.conversationId,
        }
    })
    // console.log(resp)
    return resp
}

module.exports = {startConversation}