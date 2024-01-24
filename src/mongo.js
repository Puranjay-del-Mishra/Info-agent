const { MongoClient, ObjectId } = require("mongodb")
require("dotenv").config({path: '/Users/puranjaymishra/Documents/petavue/info-agent/src/.env'})

const params = process.env


class MongoDB {
    constructor(){
        this.config = {MONGO_URI:params.MONGO_CONNECTION_STRING, DB_NAME: params.DB_NAME}
        this.newClient = undefined
    }
    async connect(){
        if(this.newClient) return this.newClient
        try{
            // console.log(this.config.MONGO_URI, this.config.DB_NAME, this.config)
            const newClient = new MongoClient(this.config.MONGO_URI)
            await newClient.connect() 
            this.newClient = newClient
        }
        catch(error){
            console.log('Got the following error while connecting! ',error)
        }
    }
    async disconnect(){
        await this.newClient.close()
        this.newClient = undefined
        console.log('Disconnected from the Database!')
    }

    async getCollection({collectionName, db = this.config.DB_NAME}){
        if(!this.newClient){
            await this.connect()
        }
        return this.newClient.db(db).collection(collectionName)
    }

    async findOne({ collectionName, query, db, options = {} }) {
        const collection = await this.getCollection({collectionName, db})
        return collection.findOne(query, options)
    }


    async find({collectionName, db = this.config.DB_NAME, query, options = {} }){
        const collection = await this.getCollection({collectionName, db})
        // console.log(collection)
        return collection.find(query, options).toArray()
    }

    async insertOne({collectionName, document, db}) {
        const collection = await this.getCollection({collectionName, db})
        const result = await collection.insertOne(document)
        return result.insertedId //returns the id
    }

    async updateOne({ collectionName, query, set, push, db =this.config.DB_NAME }) {
        const collection = await this.getCollection({collectionName, db})
        const update = {}
        if (set) update.$set = set
        if (push) update.$push = push
        const result = await collection.updateOne(query, update)
        return result.matchedCount > 0
    }

    async deleteOne(collectionName, query, db = this.config.DB_NAME) {
        const collection = await this.getCollection({collectionName, db})
        const result = await collection.deleteOne(query)
        return result.deletedCount > 0
    }

    toObjectId(idString) {
        return new ObjectId(idString)
    }
}

const insertPrompt = async(text, toolName)=>{
    const mongo = new MongoDB()
    await mongo.connect()
    const res = mongo.insertOne({collectionName: "prompts", document: {
        body: text,
        toolName: toolName,
        model: 'gpt-3.5-turbo-16k'
    }})
    return res
}
// const d = ``
// const idd = insertPrompt(d, 'DatasourcePicker')
// console.log('Done')
module.exports = MongoDB