//use openai module to call openai api
const mongoDB = require("/Users/puranjaymishra/Documents/petavue/info-agent/src/mongo.js")
const dotenv = require('dotenv')
const { OpenAI: _OpenAI } = require("openai")

const mongo = new mongoDB()

module.exports = class OpenAI {
    /**
     * @type {_OpenAI | undefined}
     */
    static #openai

    static #saveLLMLog = async (data) => {
        await mongo.insertOne({collectionName:"llm_logs", document:data, db: 'InfoAgent'})
    }

    static #init = () => {
        if (!OpenAI.#openai) {
            
            OpenAI.#openai = new _OpenAI({
                apiKey: process.env.API_KEY_35_turbo
            })
        }
    }

    static chatCompletion = async ({ messages, model, functionCall, toolName, meta }) => {
        try {
            OpenAI.#init()
            const payload = {
                model: model || "gpt-4",
                messages,
                stream: false,
                temperature: 0,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                n: 1
            }

            const options = { maxRetries: 1, timeout: 3 * 60 * 1000 }

            if (functionCall) {
                payload.functions = [JSON.parse(functionCall.function)]
                payload.function_call = {
                    name: functionCall.name
                }
            }

            const startTime = Date.now()
            const response = await OpenAI.#openai.chat.completions.create(payload, options)
            const latency = Date.now() - startTime

            await this.#saveLLMLog({
                payload,
                options,
                response,
                startTime,
                latency,
                toolName,
                ...meta
            })

            return response.choices[0]
        } catch (err) {
            console.log('Error! ', err)
            throw err
        }
    }
}
