import * as Minio from 'minio'
import { randomUUID } from 'crypto'
import path from 'path'

import { config } from '../core/config.js'

const client = new Minio.Client({
    endPoint:  config.MINIO_ENDPOINT,
    port:      config.MINIO_PORT,
    useSSL:    config.MINIO_USE_SSL,
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY
})

const BUCKET = config.MINIO_BUCKET

export async function ensureBucket(): Promise<void> {
    const exists = await client.bucketExists(BUCKET)
    if (!exists) await client.makeBucket(BUCKET)
}

export async function uploadFile(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
    const ext     = path.extname(originalName) || '.pdf'
    const fileKey = `analyses/${randomUUID()}${ext}`

    await client.putObject(BUCKET, fileKey, buffer, buffer.length, {
        'Content-Type':  mimeType,
        'original-name': originalName
    })

    return fileKey
}

export async function getFileBuffer(fileKey: string): Promise<Buffer> {
    const stream = await client.getObject(BUCKET, fileKey)

    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        stream.on('data',  chunk => chunks.push(chunk as Buffer))
        stream.on('end',   ()    => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
    })
}
