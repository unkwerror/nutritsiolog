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

```bash
ssh -p 2222 mun@109.174.15.132
```

Реальный домен: `nutrtisiolog.ru` / `api.nutrtisiolog.ru` (внимание на транспозицию букв).

## Инструменты

* Dev-инструмент (только разработка): `http://109.174.15.132:3001/dev/upload`

## Деплой

```bash
bash deploy.sh
```

---

# ТЕКУЩИЙ СТАТУС (2026-05-28)

## ✅ Этапы 10 и 11 завершены

Все фиксы и YandexAdapter сделаны. OCR работает end-to-end:
PDF → Yandex Vision OCR (sync, async fallback) → YandexGPT → LabResult → маркеры в БД.

## Ключевые файлы

| Файл                                       | Назначение              |
| ------------------------------------------ | ----------------------- |
| `api/src/index.ts`                         | Entry point API         |
| `api/src/worker.ts`                        | OCR pipeline            |
| `api/src/db/schema.ts`                     | Drizzle schema          |
| `api/src/core/config.ts`                   | ENV + Zod               |
| `api/src/core/logger.ts`                   | Pino                    |
| `api/src/modules/auth/routes.ts`           | Auth + /users/me        |
| `api/src/modules/analysis/routes.ts`       | Upload + SSE + markers  |
| `api/src/modules/analysis/repository.ts`   | Queries                 |
| `api/src/ocr/adapters/YandexAdapter.ts`    | Yandex OCR              |
| `api/src/ocr/index.ts`                     | OCR factory             |
| `api/src/modules/devtools/upload.ts`       | HTML dev-инструмент     |

---

# ИЗВЕСТНЫЕ НЕДОЧЁТЫ (не блокеры)

1. **`ocr_raw_text` не сохраняется** — колонка есть в схеме, но `parseLabResult` возвращает только `LabResult`. Нужно расширить адаптер.
2. **`ocrProvider` не в ответе `/analysis/:id`** — не попадает в `AnalysisDetailSchema`.
3. **MockAdapter не учитывает тип анализа** — всегда возвращает `sample.json`.

---

# TASK-3 — Справочник маркеров (Этап 12)

## 3a — Схема

```ts
marker_sections   // 9 разделов
marker_catalog    // ~100 показателей, aliases jsonb
marker_optimums   // по гендеру и единицам
markers.catalog_id  // nullable FK
```

## 3b — Сидер из Excel

Таблица «Оптимумы», 118 строк → INSERT ON CONFLICT DO NOTHING.

## 3c — MarkerMatcher сервис

```text
code → aliases (jsonb) → pg_trgm similarity > 0.6 → null + warn
```

## 3d — В worker

После insert markers → запустить MarkerMatcher для каждого marker.

## 3e — GET /api/v1/markers/catalog

Список для UI.

---

# TASK-4 — Квоты (Этап 13)

```sql
users.uploads_quota int default 10
users.uploads_used  int default 0
```

Проверка + транзакционный increment при createAnalysis.
При превышении → QuotaExceededError 429.

---

# TASK-5 — Анкета (Этап 14)

## Схема

* `questionnaire_templates`
* `questions`
* `questionnaire_responses`
* `answers`

## Сидер

5 шагов из ТЗ `нутрио_анкета_оптимум.html`:
1. Базовые (пол, дата рождения, рост, вес, обхват талии, цель)
2. Образ жизни (активность, сон, время сна)
3. Питание (приёмов, вода, кофе, курение)
4. Симптомы (checkbox: усталость, вздутие, и т.д.)
5. Медконтекст (лекарства, БАДы, цикл/ПМС — только для женщин)

## Routes

* `GET /questionnaire/template` — активный шаблон
* `POST /questionnaire/response` — сохранить ответы
* `GET /questionnaire/history` — история

---

# TASK-6 — Движок профиля (Этап 15)

Зависит от: Этап 12 (оптимумы) + Этап 14 (анкета) + формулы от нутрициолога.

---

# ПРАВИЛА ДЛЯ CLAUDE CODE

## Обязательно

1. Читать `CLAUDE.md` перед изменениями
2. После schema.ts:

```bash
npx drizzle-kit generate
```

3. Проверка через `/dev/upload` и `/api/docs`

## Нельзя

* `as never`, `as unknown`, `console.log`
* UPDATE маркеров/анализов/анкет (append-only)
* direct imports MinIO/BullMQ в services
* `select()` без явных полей для данных клиенту

## Git

```bash
git add <files> && git commit -m "feat: <что сделано>" && git push origin main
```

После каждой задачи — деплой на сервер.