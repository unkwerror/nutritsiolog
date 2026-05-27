# INSTRUCTIONS FOR CLAUDE CODE

# Проект: Нутрициолог API

> Перед каждой задачей обязательно читать `CLAUDE.md`

---

# Контекст

## Пути

| Что         | Путь                             |
| ----------- | -------------------------------- |
| Репозиторий | `/home/mun/nutritsiolog`         |
| API         | `/home/mun/nutritsiolog/api/src` |

## Сервер

```bash id="h3v9zk"
ssh mun@109.174.15.132
```

## Dev-инструмент

```text id="fh75d2"
http://109.174.15.132:3001/dev/upload
```

## Деплой

### Полный деплой

```bash id="z29v1a"
bash deploy.sh
```

### Быстрая перезагрузка API

```bash id="n6tr4f"
cd api
npm run build
pm2 reload ecosystem.config.cjs
```

---

# ЗАДАЧИ

> Выполнять строго по порядку

---

# TASK-1 — Точечные фиксы этапа 10

> Приоритет: **КРИТИЧНО**

---

## 1a — findByIdPublic

### Проблема

Утечка `password` через:

```http id="6x1g3n"
GET /users/me
```

---

## Файл

```text id="u3o4rm"
api/src/modules/auth/repository.ts
```

---

## Добавить метод

```ts id="d0xg9w"
async findByIdPublic(id: string) {
    const [user] = await this.db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        middleName: users.middleName,
        gender: users.gender,
        dateOfBirth: users.dateOfBirth,
        timezone: users.timezone,
        email: users.email,
        phone: users.phone,
        emailVerifiedAt: users.emailVerifiedAt,
        phoneVerifiedAt: users.phoneVerifiedAt,
        consentPd: users.consentPd,
        consentMedicalData: users.consentMedicalData,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
    }).from(users).where(eq(users.id, id))

    return user ?? null
}
```

---

## Дополнительно

### В файле

```text id="s2u6ik"
api/src/modules/auth/routes.ts
```

### Заменить

```ts id="5n8wq4"
repo.findById
```

### На

```ts id="0v41tf"
repo.findByIdPublic
```

---

## Проверить

* `MeSchema`
* соответствие response schema

---

# 1b — Ротация refresh-токена

## Файл

```text id="08jv1e"
api/src/modules/auth/routes.ts
```

## Endpoint

```http id="9e9l2o"
/auth/refresh
```

---

## Текущий баг

Новый access-token выдаётся, но старый refresh-token остаётся валидным в Redis.

---

## Нужно

### 1. Верифицировать refresh-token

> Уже реализовано

---

### 2. Удалить старый refresh

```ts id="7t7m4h"
await redis.del(`refresh:${payload.jti}`)
```

---

### 3. Сгенерировать новый токен

```ts id="2h4x0u"
buildTokens(fastify, {
    id: payload.id,
    email: payload.email
})
```

---

### 4. Сохранить новый refresh

```ts id="6jv2kl"
await redis.setex(`refresh:${newJti}`, REFRESH_TTL_SEC, payload.id)
```

---

### 5. Обновить cookie

```ts id="yz5m0v"
reply.setCookie('refreshToken', newRefreshToken, { ... })
```

Использовать те же параметры, что:

* verify-otp
* register

---

### 6. Return

```ts id="t2w3hj"
return { accessToken }
```

---

# 1c — Pino redact

## Файл

```text id="6o7a0m"
api/src/core/logger.ts
```

## Добавить

```ts id="m4q8ef"
'code',
'*.code',
```

---

# 1d — Worker status processing

## Файл

```text id="l4m8vv"
api/src/worker.ts
```

---

## Добавить после

```ts id="87ep6p"
if (current.status === 'done')
```

---

## Код

```ts id="fj4v1q"
await db
    .update(analyses)
    .set({
        status: 'processing',
        updatedAt: new Date()
    })
    .where(eq(analyses.id, analysisId))

await redis.publish(
    `analysis:${analysisId}`,
    JSON.stringify({
        status: 'processing',
        analysisId
    })
)

log.info('status set to processing')
```

---

# 1e — Health: critical vs degraded

## Файл

```text id="z6q3pa"
api/src/modules/health/routes.ts
```

---

## Изменения

### 1. Конвертировать на

```ts id="z7f4uv"
FastifyPluginAsyncZod
```

---

### 2. Новая логика

```ts id="9g8rx1"
const isCritical = pg && redis && minio

return reply
    .code(isCritical ? 200 : 503)
    .send({
        status: isCritical
            ? (smtp ? 'ok' : 'degraded')
            : 'down',
        checks
    })
```

---

### 3. HealthSchema

Было:

```ts id="x7v7s2"
z.enum(['ok', 'degraded'])
```

Стало:

```ts id="4j9m0d"
z.enum(['ok', 'degraded', 'down'])
```

---

### 4. Добавить schema response

```ts id="8m6t1k"
503: HealthSchema
```

---

# 1f — Удалить bcrypt

## Файл

```text id="t8r4hz"
api/package.json
```

---

## Удалить

### dependencies

```json id="v3y0f7"
"bcrypt": "^6.0.0"
```

### devDependencies

```json id="u1f7zq"
"@types/bcrypt": "^6.0.0"
```

---

## После изменений

```bash id="q0n4wa"
npm install
```

---

# 1g — SSE в /dev/upload

## Файл

```text id="o0w4tt"
api/src/modules/devtools/upload.ts
```

---

## Найти

```js id="j9r8pn"
const res = await fetch(API + '/analysis/' + analysisId + '/events', {...})
const text = await res.text()
const match = text.match(/data: (.+)/)
const status = match ? JSON.parse(match[1]).status : 'failed'
```

---

## Заменить

```js id="b1q8mw"
const res = await fetch(API + '/analysis/' + analysisId + '/events', {
  headers: { 'Authorization': 'Bearer ' + token }
})

const reader = res.body.getReader()
const decoder = new TextDecoder()

let buffer = ''
let lastStatus = 'failed'

while (true) {
  const { done, value } = await reader.read()

  if (done) break

  buffer += decoder.decode(value, { stream: true })

  const parts = buffer.split('\n\n')
  buffer = parts.pop() ?? ''

  for (const part of parts) {
    if (part.startsWith('data: ')) {
      try {
        const event = JSON.parse(part.slice(6))
        lastStatus = event.status
        setBadge(card, event.status)
      } catch {
        /* ignore */
      }
    }
  }
}

const status = lastStatus
```

---

# 1h — Mock fixtures

## Директория

```text id="v4j1ly"
api/src/ocr/adapters/fixtures/
```

---

## Добавить

### biochem.json

Поля:

* АЛТ
* АСТ
* ЩФ
* билирубин
* общий белок
* глюкоза
* мочевина
* креатинин

> Несколько out-of-range значений

---

### thyroid.json

Поля:

* ТТГ (высокий)
* свободный Т4
* свободный Т3

Пациент:

* женщина

---

### lipids.json

Поля:

* общий холестерин
* ЛПНП (высокий)
* ЛПВП
* ТГ

---

## Формат

Как:

```text id="3f6d1z"
sample.json
```

Структура:

* lab
* patient
* order
* markers[]

---

# TASK-2 — YandexAdapter + редактирование маркеров

> Главная задача

---

# 2a — ENV

## Файл

```text id="8v2x9m"
api/.env.example
```

---

## Добавить

```env id="5m1o8r"
# Yandex AI (required if OCR_PROVIDER=yandex)
YANDEX_API_KEY=
YANDEX_FOLDER_ID=
```

---

## Файл

```text id="s6j2e0"
api/src/core/config.ts
```

---

## ConfigSchema

```ts id="0t7m4x"
YANDEX_API_KEY: z.string().optional(),
YANDEX_FOLDER_ID: z.string().optional(),
```

---

# 2b — YandexAdapter

## Создать файл

```text id="0f7y8m"
api/src/ocr/adapters/YandexAdapter.ts
```

---

## Базовая структура

```ts id="9t4r3f"
export class YandexAdapter implements OcrService {
    constructor(private cfg: YandexAdapterConfig) {}

    async parseLabResult(
        buffer: Buffer,
        mimeType: string,
        analysisType?: string
    ): Promise<LabResult> {
        const rawText = await this.callVisionOcr(buffer, mimeType)
        return this.callGptStructure(rawText, analysisType)
    }
}
```

---

## Vision OCR

```http id="y2j8ps"
POST https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText
```

---

## GPT API

```http id="x5j7de"
POST https://llm.api.cloud.yandex.net/foundationModels/v1/completion
```

---

## Важно

### Authorization

```http id="x6k1yr"
Authorization: Api-Key ${cfg.apiKey}
```

НЕ Bearer.

---

### Vision OCR headers

```http id="n8w0po"
x-folder-id: ${cfg.folderId}
```

---

### SOCKS proxy

Для Yandex:

* НЕ использовать proxy
* Яндекс доступен напрямую

---

### Empty OCR

Если OCR вернул пустой текст:

```ts id="4f4q3j"
throw new OcrValidationError('EMPTY_OCR_RESULT')
```

---

# 2c — Регистрация адаптера

## Файл

```text id="0m3w9u"
api/src/ocr/index.ts
```

---

## Добавить

```ts id="n6g4dx"
case 'yandex': {
    if (!config.YANDEX_API_KEY || !config.YANDEX_FOLDER_ID) {
        throw new Error(
            'YANDEX_API_KEY and YANDEX_FOLDER_ID required when OCR_PROVIDER=yandex'
        )
    }

    return new YandexAdapter({
        apiKey: config.YANDEX_API_KEY,
        folderId: config.YANDEX_FOLDER_ID
    })
}
```

---

## Удалить

```ts id="6q1l8s"
throw new Error('Yandex OCR adapter is not implemented yet')
```

---

# 2d — Схема БД

## Файл

```text id="n0e3vt"
api/src/db/schema.ts
```

---

## analyses

```ts id="z1v5or"
analysisType: varchar('analysis_type', { length: 20 }),

typeSource: varchar('type_source', { length: 10 })
    .notNull()
    .default('manual'),

ocrProvider: varchar('ocr_provider', { length: 20 }),

ocrRawText: text('ocr_raw_text'),
```

---

## markers

```ts id="y8m7xa"
isEdited: boolean('is_edited')
    .notNull()
    .default(false),

originalValue: numeric('original_value', {
    precision: 12,
    scale: 4
}),
```

---

## После изменений

```bash id="6p6o1t"
npx drizzle-kit generate
```

Проверить SQL перед commit.

---

# 2e — AnalysisJobData

## Файл

```text id="g9v0rc"
api/src/worker.ts
```

---

## Обновить тип

```ts id="v2x1ca"
type AnalysisJobData = {
    analysisId: number
    fileKey: string
    mimeType: string
    analysisType?: string
    ocrProvider: string
}
```

---

## OCR вызов

```ts id="5v9o0k"
await ocrService.parseLabResult(
    buffer,
    mimeType,
    job.data.analysisType ?? undefined
)
```

---

# 2f — Эндпоинт редактирования маркеров

## Endpoint

```http id="j5m7n4"
POST /analysis/:analysisId/markers/:markerId/edit
```

---

## Требования

* Проверка IDOR
* INSERT новой версии маркера
* Никаких UPDATE
* `is_edited=true`
* `original_value=original.value`

---

## DISTINCT ON

Возвращать последнюю версию:

```sql id="1m2g0k"
SELECT DISTINCT ON (name, COALESCE(method, ''))
*
FROM markers
WHERE analysis_id = $1
ORDER BY name, COALESCE(method, ''), created_at DESC
```

---

# 2g — Обновить /dev/upload

## Добавить select

```html id="r7m1fo"
<select id="analysis-type">
```

Типы:

* cbc
* protein
* carb
* liver
* lipid
* thyroid
* electrolytes
* iron
* inflammation

---

## Передача FormData

```js id="d6j5mu"
const analysisType =
    document.getElementById('analysis-type').value

if (analysisType) {
    form.append('analysisType', analysisType)
}
```

---

## После done

Добавить:

* inline editing
* сохранение marker edits
* POST edit endpoint

---

# TASK-3 — Проверка и деплой

## Подключение

```bash id="z8n2mp"
ssh mun@109.174.15.132
```

---

## Деплой

```bash id="9e4g1z"
cd /home/mun/nutritsiolog
bash deploy.sh
```

---

# Проверить

## Health

```bash id="r5s2qa"
curl http://localhost:3001/health
```

Ожидается:

```json id="g0n9d4"
{"status":"ok"}
```

или:

```json id="o8d7jm"
{"status":"degraded"}
```

---

## PM2

```bash id="h5s0vf"
pm2 status
```

Оба процесса:

```text id="3n4x8g"
running
```

---

## Dev upload

Проверить flow:

```text id="r6d7ty"
pending → processing → done
```

---

# ПРАВИЛА ДЛЯ CLAUDE CODE

## Обязательно

1. Перед изменениями читать `CLAUDE.md`
2. После каждого файла:

```bash id="k5u0x1"
npm run typecheck
```

3. После schema.ts:

```bash id="6f4q8y"
npx drizzle-kit generate
```

4. Проверка через:

* `/dev/upload`
* `/api/docs`

---

## Нельзя

* `as never`
* `as unknown`
* `console.log`
* UPDATE маркеров
* direct imports MinIO/BullMQ в services

---

## Можно

```ts id="m8r1cn"
process.stderr.write(...)
process.stdout.write(...)
```

---

## Git

После каждой задачи:

```bash id="x3t2kf"
git commit -m "feat: <что сделано>"
```

---

# Быстрый справочник

## Ключевые файлы

| Файл                                    | Назначение       |
| --------------------------------------- | ---------------- |
| `api/src/index.ts`                      | Entry point API  |
| `api/src/worker.ts`                     | OCR pipeline     |
| `api/src/db/schema.ts`                  | Drizzle schema   |
| `api/src/core/config.ts`                | ENV + Zod        |
| `api/src/core/logger.ts`                | Pino             |
| `api/src/modules/auth/routes.ts`        | Auth + /users/me |
| `api/src/modules/analysis/routes.ts`    | Upload + SSE     |
| `api/src/ocr/adapters/GeminiAdapter.ts` | Gemini OCR       |
| `api/src/ocr/adapters/YandexAdapter.ts` | Создать          |
| `api/src/ocr/index.ts`                  | OCR factory      |
| `api/src/modules/devtools/upload.ts`    | HTML devtool     |

---

# Yandex Vision OCR API

```http id="h1o7vw"
POST https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText
```

Headers:

```http id="c4q7ax"
Authorization: Api-Key {key}
x-folder-id: {folderId}
```

Body:

```json id="q6n9ro"
{
  "content": "base64",
  "mimeType": "application/pdf",
  "languageCodes": ["ru"],
  "model": "page"
}
```

---

# YandexGPT Pro API

```http id="f0e6gh"
POST https://llm.api.cloud.yandex.net/foundationModels/v1/completion
```

Body:

```json id="h7z0bk"
{
  "modelUri": "gpt://{folderId}/yandexgpt/latest",
  "completionOptions": {
    "stream": false,
    "temperature": 0
  },
  "messages": []
}
```

---

# pgEnum analysis_type

```ts id="n1f9ma"
export const analysisTypeEnum = pgEnum('analysis_type', [
    'cbc',
    'protein',
    'carb',
    'liver',
    'lipid',
    'thyroid',
    'electrolytes',
    'iron',
    'inflammation'
])
```
