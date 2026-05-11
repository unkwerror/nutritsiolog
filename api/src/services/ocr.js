import { GoogleGenAI } from '@google/genai'

import { withRetry } from '../utils/retry.js'
import { SYSTEM_INSTRUCTION, PARSE_PROMPT } from '../prompts/analysis.js'
import { validateLabResult } from '../utils/validateLabResult.js'

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
        headers: { 'Accept-Encoding': 'identity' }
    }
})



export async function parseLabResult(fileBuffer, mimeType = 'application/pdf') {
    const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0
        },
        contents: [{
            parts: [
                {text: PARSE_PROMPT},
                {inlineData: { mimeType, data: fileBuffer.toString('base64')}}
            ]
        }]
    }))

    try {
        const parsed = JSON.parse(response.text)
        return validateLabResult(parsed)
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