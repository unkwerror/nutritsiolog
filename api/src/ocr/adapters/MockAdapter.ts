import path              from 'node:path'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath }    from 'node:url'
import { type OcrService }  from '../OcrService.js'
import { validateLabResult, type LabResult } from '../types.js'

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

export class MockAdapter implements OcrService {
    async parseLabResult(_buffer: Buffer, _mimeType: string, _analysisType?: string): Promise<LabResult> {
        const all   = await readdir(FIXTURES_DIR)
        const files = all.filter(f => f.endsWith('.json'))

        if (files.length === 0) throw new Error('MockAdapter: no fixture files found')

        const file = files[Math.floor(Math.random() * files.length)]!
        const raw  = JSON.parse(await readFile(path.join(FIXTURES_DIR, file), 'utf-8'))

        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000))

        return validateLabResult(raw)
    }
}
