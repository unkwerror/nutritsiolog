import * as Minio from 'minio'
import { randomUUID } from 'crypto'
import path from 'path'

const client = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT,
    port:      Number(process.env.MINIO_PORT),
    useSSL:    process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
})

const BUCKET = process.env.MINIO_BUCKET

export async function ensureBucket() {
    const exists = await client.bucketExists(BUCKET)
    if (!exists) await client.makeBucket(BUCKET)
}

export async function uploadFile(buffer, originalName, mimeType) {
    const ext = path.extname(originalName) || '.pdf'
    const fileKey = `analyses/${randomUUID()}${ext}`

    await client.putObject(BUCKET, fileKey, buffer, buffer.length, {
        'Content-Type': mimeType,
        'original-name': originalName
    })

    return fileKey
}

export async function getFileBuffer(fileKey) {
    const stream = await client.getObject(BUCKET, fileKey)
    return new Promise((resolve, reject) => {
        const chunks = []
        stream.on('data', chunk => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
    })
}
