const fs = require('fs')
const mongoDB = require("/Users/puranjaymishra/Documents/petavue/info-agent/src/mongo.js")
const text = fs.readFileSync("/Users/puranjaymishra/Documents/petavue/info-agent/callcenter.txt", 'utf8')
const { OpenAI: _OpenAI } = require("openai")
require('dotenv').config()

const mongo = new mongoDB()


async function chunkData(inputData) {
    const tables_w_summary = {}
    const tables = inputData.split("Table Name:");
    const tableObjects = [];

    for(let i = 1; i < tables.length ; i++){ 
        const currentTable = tables[i].split("\n");

        let tableName = currentTable[0].trim();

        let indexTillWhereTableDescAvailable = currentTable.indexOf('Columns:');
        let tableDescription = currentTable.slice(1,indexTillWhereTableDescAvailable).join("\n").trim();

        let columns = currentTable.slice(indexTillWhereTableDescAvailable + 1, currentTable.length).join("\n").trim();
        // console.log(columns)
        // console.log('\n')
        const openai = new _OpenAI({
            apiKey: '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'
        })
        const messages = []
        const prompt = 'Compress the following text in such a way that it still retains the clearly recognisable identity of the table but uses strictly less than 50 words. Include all the essential information so that it can be easily identified when searched for, using vector search. Avoid using the column names directly, insert the essence of important columns if required. Also list out the tables it is linked to, concisely, add this list at the end of the summary. Replace the under score from tables names with an empty space.'
        tableObjects.push({
            "tableName": tableName,
            "tableDescription": tableDescription,
            "columns": columns
        });

        const fullInfo = `{
            "tableName": ${tableName},
            "tableDescription": ${tableDescription},
            "columns": ${columns}
        }`

        messages.push({'role':'system', 'content':prompt})
        messages.push({'role':'user', 'content': fullInfo})

        const payload = {
            messages,
            model:'gpt-4',
            stream: false,
            temperature: 0,
            top_p: 1,
        }
        const options = { maxRetries: 1, timeout: 3 * 60 * 1000 }
        const response = await openai.chat.completions.create(payload, options)
        const summary =  response.choices[0]['message'].content
        const columnList = columns.match(/(?<=\n|^)(.*?):/gm).map(id => id.slice(0, -1));
        console.log(summary)
        const idd = await mongo.insertOne({
            collectionName: "Tables",
            document:{
                tableName: tableName,
                tableDescription: summary,
                columnList: columnList,
                fullInfo: fullInfo,
                Datasource: "Call center data"
            },
            db: 'InfoAgent'
        })
    }
    console.log('Data chunked!')
    return {tableObjects, tables_w_summary};
}


// const {ans, tables_w_summary} = chunkData(text)


const saveDatasourceInfo = async(text, datasourceName) =>{
    const tableList = ["WEB_SITE", "WEB_SALES",  "WEB_RETURNS", "WEB_PAGE", "WAREHOUSE", "TIME_DIM", "STORES_SALES", "STORE_RETURNS", "STORE", "SHIP_MODE","REASON", "PROMOTION", "ITEM", "INVENTORY", "INCOME_BAND","HOUSEHOLD_DEMOGRAPHICS", "DATE_DIM", "CUSTOMER_DEMOGRAPHICS",  "CUSTOMER_ADDRESS", "CUSTOMER", "CATALOG_SALES", "CATALOG_RETURNS", "CATALOG_PAGE", "CALL_CENTER"]
    const id = await mongo.insertOne({
            collectionName: "Datasources",
            document:{
                datasourceName: datasourceName,
                datasourceDescription: text,
                tableList: tableList,
            },
            db: 'InfoAgent'
        })
    return id
}

// const data = `The Call Center data source has E-commerce and physical retail data: web page details, customer profiles, and transactions; warehouse and item inventory; demographic segmentation; promotional campaigns; shipping modes; income bands; catalog and store sales/returns; call center interactions; time and date dimensions.`

// const iddd = saveDatasourceInfo(data, "CallCenterDatasource")
// console.log(iddd)
