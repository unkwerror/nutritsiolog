import * as Minio from 'minio'
import { randomUUID } from 'crypto'
import path from 'path'
import { config } from '../../../core/config.js'

export interface StoragePort {
    upload(buffer: Buffer, originalName: string, mimeType: string): Promise<string>
    getBuffer(fileKey: string): Promise<Buffer>
    ensureBucket(): Promise<void>
}

export class MinioStorage implements StoragePort {
    private client: Minio.Client
    private bucket: string

    constructor() {
        this.client = new Minio.Client({
            endPoint: config.MINIO_ENDPOINT,
            port: config.MINIO_PORT,
            useSSL: config.MINIO_USE_SSL,
            accessKey: config.MINIO_ACCESS_KEY,
            secretKey: config.MINIO_SECRET_KEY,
        })
        this.bucket = config.MINIO_BUCKET
    }

    async ensureBucket(): Promise<void> {
        const exists = await this.client.bucketExists(this.bucket)
        if (!exists) await this.client.makeBucket(this.bucket)
    }

    async upload(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
        const ext = path.extname(originalName) || '.pdf'
        const fileKey = `analyses/${randomUUID()}${ext}`
        await this.client.putObject(this.bucket, fileKey, buffer, buffer.length, {
            'Content-Type': mimeType,
            'original-name': encodeURIComponent(originalName),
        })
        return fileKey
    }

    async getBuffer(fileKey: string): Promise<Buffer> {
        const stream = await this.client.getObject(this.bucket, fileKey)
        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = []
            stream.on('data', (chunk) => chunks.push(chunk as Buffer))
            stream.on('end', () => resolve(Buffer.concat(chunks)))
            stream.on('error', reject)
        })
    }
}
