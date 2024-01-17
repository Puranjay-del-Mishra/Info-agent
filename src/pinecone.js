const {Pinecone} = require('@pinecone-database/pinecone')
const pinecone = new Pinecone({
    apiKey: 'fbaf4f87-e3ac-48af-b113-cf8582a8dcd5',
    environment: 'gcp-starter',
})

async function checkPineconeIndex(){
    const resp = await pinecone.describeIndex('petavue-index-1')
    console.log(resp)
}

async function upsertRecords(data){
    const index = pinecone.index('petavue-index-1')
    await index.upsert(vectors = data)
}

async function vectorSearch(chunk){
    const resp = await pinecone.index('petavue-index-1').query({ topK: 3, vector: chunk, includeValues: true})
    return resp
}

async function idSearch(id){
    const ans = await pinecone.index('petavue-index-1').query({topK: 1, id: id, includeValues:true})
    return ans
}

module.exports = {checkPineconeIndex, upsertRecords, vectorSearch, idSearch}

