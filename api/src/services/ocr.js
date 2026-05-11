import { GoogleGenAI } from '@google/genai' 
import { socksDispatcher } from 'fetch-socks'

import { SYSTEM_INSTRUCTION, PARSE_PROMPT } from '../prompts/analysis.js'


const proxyUrl = new URL(process.env.SOCKS_PROXY)

const dispatcher = socksDispatcher({
    type: 5,
    host: proxyUrl.hostname,
    port: Number(proxyUrl.port)
})

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
httpOptions: {
    fetch: (url, options) => {
        console.log('proxy fetch called:', url)
        return fetch(url, {...options, dispatcher})
        }
    }
})

export async function parseLabResult(fileBuffer, mimeType = 'application/pdf') {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json'
        },
        contents: [{
            parts: [
                {text: PARSE_PROMPT},
                {inlineData: { mimeType, data: fileBuffer.toString('base64')}}
            ]
        }]
    })
    
    try {
        return JSON.parse(response.text)
    } catch {
        console.error('Raw Gemini response:', response.text)
        throw new Error('Failed to parse Gemini response')
    }
}

export async function parseLabResults(files) {
    const promises = files.map(file => 
        parseLabResult(file.buffer, file.mimeType)
    )
    
    const results = await Promise.allSettled(promises)

    return results.filter(result => {
            if (result.status === 'rejected') {
                console.error(result.reason)
                return false
            }
            return true;
        }).map(result => result.value)
}