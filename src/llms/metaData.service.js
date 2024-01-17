const {HfInference} = require('@huggingface/inference')
const monogDB = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/mongo.js')
const embedding = new HfInference('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')
const dotenv = require('dotenv')
const {ObjectId} = require('mongodb')
const {checkPineconeIndex, upsertRecords, vectorSearch, idSearch} = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/pinecone.js');
const { type } = require('os');
const OpenAI = require('openai')
const {compressResponse} = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/services/chat/chat.utils.js')
const typeIs = require('type-is');
const fs = require('fs')
dotenv.config()

const openai = new OpenAI({
    apiKey: process.env.API_KEY_35_turbo
})


async function getEmbeddings(input){
    // BEST METHOD
    const embedding = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: input,
        encoding_format: "float",
    })
    return embedding['data'][0]['embedding']
}

async function saveVectors(){
    const mongo = new monogDB()
    await mongo.connect()
    let cnt = 0
    const chunk_size_arr = [900]
    const overlap_size_arr = [200]

    for(let r=0;r<chunk_size_arr.length;r++)
    {
        const chunk_size = chunk_size_arr[r]
        const overlap_size = overlap_size_arr[r]
        // const data = await mongo.find({collectionName:'metaData', query: {}, db: 'InfoAgent', options:{}}) For thec current Petavue meta Data

        // const text = data[0]['data']

        const text = fs.readFileSync("/Users/puranjaymishra/Documents/petavue/info-agent/callcenter.txt", 'utf8')

        try{
            checkPineconeIndex()
            console.log("Pine cone index exists!")
        }
        catch(err){
            console.log('Got the following error when checking for Pinecone Index!', err)
        }

    
        let i = 0;
    
        records = []
        while(i<text.length){
            const text_array = []
            if(i==0){
                const text_chunk = text.slice(i,Math.min(i+chunk_size+overlap_size, text.length))
                text_array.push(text_chunk)
            }
            else{
                const text_chunk = text.slice(i-overlap_size, Math.min(i+chunk_size+overlap_size, text.length))
                text_array.push(text_chunk)
            }
            cnt += 1;

            const chunk_data = await getEmbeddings('Column names are representative of the table a column belongs to. Encode the information based on column names. For example, CS_SOLD_DATE_SK belongs to Catalogue Sales and HD_BUY_POTENTIAL\n'+text_array[0])
            const inserted_id = await mongo.insertOne({collectionName: 'vectorData', 
            document: {
                vector: chunk_data,
                vectorId: cnt,
                text: text_array[0]
            }, db:process.env.DB_NAME})
            // console.log(chunk_data)
            records.push({
                id: `${cnt}`,
                values: chunk_data
            })
            i += chunk_size
            console.log(cnt)
        }
        upsertRecords(records)
        console.log('Records upserted!')
    }
}

const getMetaDataInfo = async (data)=> {

    let inp_data = 'User and AI assistant conversation logs. Focus on and encode the context of user queries carefully\n'

    for(let i=0;i<data.length;i++){
        inp_data = inp_data + `Role: ${data[i]['role']}` 
        if(data[i]['role']=='user'){
            inp_data = inp_data + ' #'
        }
        if(data[i]['role']=='assistant'){
            const superCompresponse = await compressResponse(data[i]['content'], 'SuperCompressor')
            // console.log('Super compressed response=', superCompresponse.message.content)
            inp_data = inp_data + ` Message: ${superCompresponse.message.content}\n`
        }
        else{
            inp_data = inp_data + ` Message: ${data[i]['content']}\n`
        }
    }
    // console.log('Data use to get the meta Data-', inp_data)
    // console.log(inp_data)
    const mongo = new monogDB()
    await mongo.connect()

    const embedding = await getEmbeddings(inp_data)
    const matches = await vectorSearch(embedding)
    const metaData = []

    for(let i=0;i<matches["matches"].length;i++){
        const doc = await mongo.findOne({
            collectionName: "vectorData",
            query: {"vectorId": parseInt(matches["matches"][i]["id"])},
            db: process.env.DB_NAME,
            options: {}
        })
        metaData.push(doc['text'])
        console.log('\n')
        console.log(doc['text'])
        console.log('\n')
    }
    // console.log(metaData)
    return metaData
}
//  collectionName, query, db, options = {} }

// saveVectors()

// getMetaDataInfo(`[
//     {
//       role: 'user',
//       content: 'Hey, can i know about the salesforce data that i have?'
//     }
//   ]`)


function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = getMetaDataInfo