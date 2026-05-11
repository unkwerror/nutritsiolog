import { parseLabResult, parseLabResults } from "../services/ocr.js"
import { withRetry } from "../utils/retry.js"

export default async function analysisRoutes(fastify) {

    fastify.post('/analysis/upload', async (request, reply) => {

        const files = []

        for await (const part of request.files()) {
            const buffer = await part.toBuffer()
            files.push({ buffer, mimeType: part.mimetype })
        }

        if(files.length === 0)
            return reply.code(400).send('Nothing uploaded')
        if(files.length === 1)
            return withRetry(parseLabResult(files[0].buffer, files[0].mimeType))
        if(files.length > 1)
            return parseLabResults(files)
    })
}