const prompt = `You are a smart inverted index creator. For a given set of tables and their description-
#Generate a list of 3 indices, with each list of index having 10 key words and phrases which accurately describe the tables stored by each index.
#Make sure that all the provided tables belong to one of these 3 indices
# return it as follows - [{index1: string, list of tables1: array[tables]}]
`
const { OpenAI: _OpenAI } = require("openai")
const mongoDB = require("/Users/puranjaymishra/Documents/petavue/info-agent/src/mongo.js")
const mongo = new mongoDB()

const invertedIndex = async (tables) =>{
    const openai = new _OpenAI({
        apiKey: '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'
    })
    const messages = []
    messages.push({'role':'system', 'content':prompt})
    messages.push({'role':'user', 'content': tables})
    const payload = {
        messages,
        model:'gpt-4-1106-preview',
        stream: false,
        temperature: 0,
        top_p: 1,
    }
    const options = { maxRetries: 1, timeout: 3 * 60 * 1000 }
    const response = await openai.chat.completions.create(payload, options)
    const invIndex =  response.choices[0]['message'].content
    return invIndex
}

const makeInvertedIndex = async()=>{
    const tables = await mongo.find({
        collectionName:'Tables',
        db:"InfoAgent",
        query:{},
        options:{}
    })
    const data = JSON.stringify(tables)
    const ans = await invertedIndex(data)
    console.log(ans)
    return ans
}


makeInvertedIndex()