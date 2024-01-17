const mongoDB = require("/Users/puranjaymishra/Documents/petavue/info-agent/src/mongo.js")
const params = require('dotenv')
const {ObjectId} = require('mongodb')
const { OpenAI: _OpenAI } = require("openai")
const { message } = require("statuses")
params.config()
const mongo = new mongoDB()

const autoIncrementStepIds = (steps, messages) => {
    let lastStepId = 0
    let stepMap = {}

    //loop through all messages
    for (let message of messages) {
        //loop through all steps in each message
        if (message.role === "assistant") {
            let prevSteps = []
            try {
                prevSteps = JSON.parse(message.content)?.steps
            } catch (err) {
                err
            }
            for (let step of prevSteps) {
                //if the stepId is greater than the lastStepId, set lastStepId to stepId
                if (step.id > lastStepId) {
                    lastStepId = step.id
                }
            }
        }
    }

    lastStepId++
    //loop through all steps and increment stepId by 1
    for (let step of steps) {
        stepMap[step.id] = lastStepId
        step.id = lastStepId
        lastStepId++
    }

    //loop through dependencies and update stepId
    for (let step of steps) {
        step.depends = step.depends?.map((d) => stepMap[d] || d)
    }

    return steps
}

const storeConv = async (body) => {
    const convId = await mongo.insertOne({collectionName: "conversation", document:
    {
        _id: body.conversationId,
        name: "Greetings",
        createdOn: Date.now()
    }, db: 'InfoAgent'})
    return convId
}

const saveMessage = async (body) => {
    const compressed_resp = await compressResponse(body.llm_resp.message.content, 'ContentCompressor')
    console.log('\n\n')
    console.log('The response is- ', body.llm_resp.message.content)
    // console.log('The compressed response is- ', compressed_resp)
    const messageId = await mongo.insertOne({collectionName:"messages", document: 
    {
        conversationId: body.conversationId,
        query: body.query,
        startTime: Date.now(),
        status: "started",
        mid: body.mid,
        llm_respone: body.llm_resp.message.content,
        llm_respone_compressed: compressed_resp.message.content,
        metaData: body,
        enrichedQuery: body.enrichedQuery
    },
    db: 'InfoAgent'})
    return messageId
}

// const saveLLMlogs = async ({query, metaData, response, conversationId}) =>{
//     const logId = await mongo.insertOne({collectionName:"llm_logs", document: 
//     {
//         conversationId: conversationId,
//         query: query,
//         startTime: Date.now(),
//         status: "started",
//         mid: body.mid,
//         llm_respone: body.llm_resp.message.content,

//     },
//     db: 'InfoAgent'})
//     return logeId
// }

const getPrevContext = async (conversationId) => {
    let prevContext = []
    let messages = await mongo.find({
        collectionName: "messages",
        query: { conversationId: new ObjectId(conversationId) },
        db: 'InfoAgent',
        options: {
            projection: { mid: 1, enrichedQuery: 1, metaData: 1, llm_respone_compressed: 1},
            sort: { _id: 1 }
        }
    })

    let lastMessageId = 0

    if (messages.length) lastMessageId = messages[messages.length - 1]?.mid || 0

    messages.map((message) => {
        //sometimes llm calls can fail inbetween without we updating planner response
        //just filtering those messages
        if (message.llm_respone_compressed) {
            prevContext.push({
                role: "user",
                content: message.enrichedQuery
            })

            prevContext.push({
                role: "assistant",
                content: message.llm_respone_compressed
            })

        }
    })

    return { prevContext, lastMessageId}
}

const fetchPrompt = async (toolName) => {
    const prompt = await mongo.findOne({
        collectionName: 'prompts',
        query: {
            toolName: toolName
        },
        db: "InfoAgent"
    })
    return prompt
}

const compressResponse = async (text, compressorType)=>{
    const openai = new _OpenAI({
        apiKey: process.env.API_KEY_35_turbo
    })
    const messages = []
    const prompt = await fetchPrompt(compressorType)
    messages.push({'role':'system', 'content':prompt.body})
    messages.push({'role':'user', 'content':text})

    const payload = {
        messages,
        model:'gpt-3.5-turbo-1106',
        stream: false,
        temperature: 0,
        top_p: 1,
    }
    const options = { maxRetries: 1, timeout: 3 * 60 * 1000 }
    const response = await openai.chat.completions.create(payload, options)
    return response.choices[0]
}

const queryEnricher = async (query)=>{
    let query_logs = ''
    query.map((message)=>{
        if(message['role']=='user'){
            query_logs = query_logs + `Role: ${message['role']}, ` 
        }
        else{
            query_logs = query_logs + `Role: AI assistant, ` 
        }
        query_logs = query_logs + `Message: ${message['content']}\n`
    })
    const openai = new _OpenAI({
        apiKey: process.env.API_KEY_35_turbo
    })
    const messages = []
    const prompt = await fetchPrompt('InputEnricher')
    messages.push({'role':'system', 'content':prompt.body})
    messages.push({'role':'user', 'content': query_logs})
    // console.log(messages)
    const payload = {
        messages,
        model:'gpt-3.5-turbo-1106',
        stream: false,
        temperature: 0,
        top_p: 1,
    }
    const options = { maxRetries: 1, timeout: 3 * 60 * 1000 }
    const response = await openai.chat.completions.create(payload, options)
    return response.choices[0]['message'].content
}

module.exports = {storeConv, autoIncrementStepIds, saveMessage, getPrevContext, fetchPrompt, queryEnricher, compressResponse}

