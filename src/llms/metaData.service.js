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
const {fetchPrompt} = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/services/chat/chat.utils.js')
const fs = require('fs')
dotenv.config()
const mongo = new monogDB()
mongo.connect()

const openai = new OpenAI({
    apiKey: process.env.API_KEY_35_turbo
})


async function getEmbeddings(input){
    // const embedding = await openai.embeddings.create({
    //     model: "text-embedding-ada-002",
    //     input: input,
    //     encoding_format: "float",
    // })
    const val = await embedding.featureExtraction({"model": "WhereIsAI/UAE-Large-V1", 'inputs':input}) //"WhereIsAI/UAE-Large-V1"
    const embedVecs = val[0][0]
    return embedVecs
}

async function saveVectors(){
    const mongo = new monogDB()
    await mongo.connect()
    let cnt = 0
    const chunk_size_arr = [900]
    const overlap_size_arr = [200]

    for(let r=0;r<chunk_size_arr.length;r++)
    {
        
        const data = await mongo.find({collectionName:'Tables', query: {}, db: 'InfoAgent', options:{projection:{
            tableName: 1,
            tableDescription: 1,
            fullInfo: 1
        }}}) 

        // const text = data[0]['data']

        // const text = fs.readFileSync("/Users/puranjaymishra/Documents/petavue/info-agent/callcenter.txt", 'utf8')

        try{
            checkPineconeIndex()
            console.log("Pine cone index exists!")
        }
        catch(err){
            console.log('Got the following error when checking for Pinecone Index!', err)
        }

    
        let i = 0;
    
        records = []
        while(i<data.length){
            const text_array = {}
            text_array['tableName'] = data[i].tableName
            text_array['tableDescription'] = data[i].tableDescription

            cnt += 1;
            const embedInp = JSON.stringify(text_array)
            const chunk_data = await getEmbeddings(embedInp)
            const inserted_id = await mongo.insertOne({collectionName: 'vectorData', 
            document: {
                vector: chunk_data,
                vectorId: cnt,
                fullInfo: data[i].fullInfo,
                tableName: data[i].tableName,
                tableDescription: data[i].tableDescription,
                datasourceName: 'Call center data'
            }, db:process.env.DB_NAME})
            // console.log(chunk_data)
            records.push({
                id: `${cnt}`,
                values: chunk_data
            })
            i += 1
            console.log(cnt)
        }
        upsertRecords(records)
        console.log('Records upserted!')
    }
}

// saveVectors()


const getDataSources = async (message_log)=> {

    // let inp_data = ''
    // for(let i=0;i<message_log.length;i++){
    //     inp_data = inp_data + `Role: ${message_log[i]['role']}` 
    //     if(message_log[i]['role']=='user'){
    //         inp_data = inp_data + ' #'
    //     }
    //     inp_data = inp_data + ` Message: ${message_log[i]['content']}\n`
    // }
    const improvedQuery = await enrichedQuery(message_log)

    const messages = []
    const prompt = await fetchPrompt('DatasourcePicker')
    const datasourcesInfo = await mongo.find({
        //collectionName, db = this.config.DB_NAME, query, options = {}
        collectionName: 'Datasources',
        db: 'InfoAgent',
        query: {},
        projection: {
            datasourceName: 1, datasourceDescription: 1, tableList: 0
        }
    })

    let dataSource_data = ''
    const DatasourceDescription = {}
    for(let i=0;i<datasourcesInfo.length;i++){
        dataSource_data = dataSource_data + '['+ JSON.stringify(datasourcesInfo[i].datasourceName) +':'+ '\n' +  JSON.stringify(datasourcesInfo[i].datasourceDescription)+']'
        DatasourceDescription[datasourcesInfo[i].datasourceName] = datasourcesInfo[i].datasourceDescription
    }

    messages.push({'role':'system', 'content':prompt.body + `[SCHEMA]\n${dataSource_data}\n[/SCHEMA]`})
    
    messages.push({'role':'user', 'content': improvedQuery})
    // console.log(messages)
    // console.log('The payload for the  datasource picker is -', messages)

    const payload = {
        messages,
        model:'gpt-3.5-turbo-16k',
        stream: false,
        temperature: 0,
        top_p: 1,
    }

    const func = [{
        "type": "function",
        "function": {
            "name": "print_relevant_data_sources",
            "description": "This function prints the relevant data sources for user query that are also present in the meta data. ",
            "parameters": {
                "type": "object",
                "properties": {
                    "relevant_data_source_list": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "A list of relevant data sources which are also present in the given meta data .This array only contains data source names.",
                    }
                },
                "required": ["relevant_data_source_list"],
            },
        }
    }]

    payload.tools = func
    payload.tool_choice = {"type": "function", "function": {"name": "print_relevant_data_sources"}}

    const options = { maxRetries: 1, timeout: 3 * 60 * 1000 }
    const response = await openai.chat.completions.create(payload, options)
    // console.log(response)
    const ans = response.choices[0]['message'].tool_calls
    
    const datasources = JSON.parse(ans[0].function.arguments)["relevant_data_source_list"]
    const res = []
    datasources.map((datasource)=>{
        res.push({Datasource:datasource, DatasourceDescription: DatasourceDescription[datasource]})
    })
    return res
}


const getMetaData = async (message_log, dsList)=> {
    const tables = {}
    for(let i=0;i<dsList.length;i++){
        if(dsList[i].DatasourceDescription){
            const improvedQuery = await enrichedQuery(message_log)
            
            const userEmbeddings = await getEmbeddings(improvedQuery)
            const topKTables  = await vectorSearch(userEmbeddings)
            const tableIds = []
            for(let t=0;t<topKTables.matches.length;t++){
                tableIds.push(parseInt(topKTables.matches[t].id))
            }
    
            const tableDataList = await mongo.find({
                collectionName:"vectorData",
                db:"InfoAgent",
                query: {'vectorId':{$in:tableIds}, 'datasourceName':dsList[i].Datasource}, //getting top 5 tables and running table picker on this
                options: {
                    tableName: 1, tableDescription: 1
                }
            })
            
            const prompt = await fetchPrompt('TablePicker')
            let tableData = ''
            const tablesCollection = await mongo.find({
                collectionName: "Tables",
                db: "InfoAgent",
                query: {},
                options: {}
            })
    
            const tableInfo = {}
            for(let i=0;i<tablesCollection.length;i++){
                // const columnList = tablesCollection[i].columnList.toString()
                tableInfo[tablesCollection[i].tableName] = {}
                tableInfo[tablesCollection[i].tableName]['TableDescription'] = tablesCollection[i].tableDescription
                // tableInfo[tablesCollection[i].tableName]['columnList'] = columnList
            }
            
            for(let i=0;i<tableDataList.length;i++){
                const tableObject = {
                    TableName: tableDataList[i].tableName,
                    TableDescription: tableDataList[i].tableDescription,
                    // ColumnsList: columnList
                }
                tableData = tableData + JSON.stringify(tableObject) +'\n'
                }
            
            const messages = []
            messages.push({'role':'system', 'content':prompt.body +'\n' +`[META]\n${tableData}\n[/META]`})
            messages.push(...message_log)
            
            // console.log('The payload for the  table picker is -', messages)
            const payload = {
                messages,
                model:'gpt-3.5-turbo-16k',
                stream: false,
                temperature: 0,
                top_p: 1,
            }
        
            const func = [{
                "type": "function",
                "function": {
                    "name": "print_detected_Tables",
                    "description": "This function prints the detected tables in the last message of the conversation log that are also present in the meta data. ",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "detected_tablesList": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "A list of tables detected in the last message of the conversation log, which are also present in the meta data.",
                            }
                        },
                        "required": ["detected_tablesList"],
                    },
                }
            }]
            
            payload.tools = func
            payload.tool_choice = {"type": "function", "function": {"name": "print_detected_Tables"}}
            
            const options = { maxRetries: 1, timeout: 3 * 60 * 1000 }
            const response = await openai.chat.completions.create(payload, options)
            const ans = response.choices[0]['message'].tool_calls
    
            const table = JSON.parse(ans[0].function.arguments)["detected_tablesList"]
            dsList[i].tables = []
            for(let j=0;j<table.length;j++){
                try{
                    dsList[i].tables.push({
                        TableName: table[j],
                        TableDescription: tableInfo[table[j]].TableDescription,
                        // ColumnsList:  tableInfo[table[j]].columnList
                    })
                }
                catch(err){
                    
                }
            }
        }
    }
    return dsList
}

const enrichedQuery = async (message_log)=>{
    const enricherCollect = await mongo.find({
        collectionName: 'prompts',
        db: "InfoAgent",
        query: {
            toolName: "InputEnricher"
        },
        options: {}
    })
    const enricherPrompt = enricherCollect[0].body
    const enricherExtent = Math.min(message_log.length, 7) // how many conversations does it cover, when enriching the final message
    const enricherInp = message_log.slice(message_log.length - enricherExtent,)
    const messages0 = []
    messages0.push({'role':'system','content':enricherPrompt})
    messages0.push(...enricherInp)
    const payload0 = {
        messages:messages0,
        model:'gpt-3.5-turbo-16k',
        stream: false,
        temperature: 0,
        top_p: 1,
    }
    const options0 = { maxRetries: 1, timeout: 3 * 60 * 1000 }
    const func0 = [{
        "type": "function",
        "function": {
            "name": "print_improved_final_query",
            "description": "This function prints the improved query, asked by the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "improved_final_query": {
                        "type": "string",
                        "description": "The improved query, asked by the user.",
                    }
                },
                "required": ["improved_final_query"],
            },
        }
    }]
    
    payload0.tools = func0
    payload0.tool_choice = {"type": "function", "function": {"name": "print_improved_final_query"}}
    const resp = await openai.chat.completions.create(payload0, options0)
    const ans0 = resp.choices[0]['message'].tool_calls
    const improvedQuery = JSON.parse(ans0[0].function.arguments)["improved_final_query"]
    return improvedQuery
}

module.exports = {getDataSources, getMetaData}