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
        const prompt = 'Your job is to give an indepth summary of the table based on the description and columns given by the user without exceeding the word count of 50'
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

        // const idd = await mongo.insertOne({
        //     collectionName: "Tables",
        //     document:{
        //         tableName: tableName,
        //         tableDescription: summary,
        //         columnList: columnList,
        //         fullInfo: fullInfo
        //     },
        //     db: 'InfoAgent'
        // })
        console.log(i,'\n')
    }

    return {tableObjects, tables_w_summary};
}

// const {ans, tables_w_summary} = chunkData(text)
// console.log(tables_w_summary)


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

// const data = `The Call Center Dataset is a clear collection of tables providing key insights for our organization in both online and offline sales scenarios. The dataset includes parts like 'WEB_SALES,' 'WEB_RETURNS', and 'WEB_SITE', recording sales data, return numbers, and specific information on various online sales websites. Useful tables such as 'WAREHOUSE' and 'STORE_SALES' list logistical parts and offline sales data, letting us understand our supply chain and store sales.
// Important tables like 'CUSTOMER', 'CUSTOMER_DEMOGRAPHICS,' and 'CUSTOMER_ADDRESS' play key roles in recording demographic data. This information helps create detailed customer profiles, smart marketing plans, and tailored customer experiences. Tables like 'ITEM' and 'INVENTORY' are vital for maintaining a good inventory system by following product availability and demand.
// The 'SHIP_MODE' table helps improve delivery methods. Other tables like 'REASON,' 'PROMOTION,' 'INCOME_BAND,' 'HOUSEHOLD_DEMOGRAPHICS,' and 'CALL_CENTER' provide a different view on customer feedback, promotion success, income groups, and family demographics, which helps decision-making leading to better customer happiness and work efficiency.`

// const iddd = saveDatasourceInfo(data, "CallCenterDatasource")
// console.log(iddd)
