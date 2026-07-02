// Идемпотентный сидер справочника и контента (решения 032 / улучшение #5).
// Единственный источник истины — profile/optimums.ts и profile/content.ts,
// БД синхронизируется из них. Запуск: npm run seed (после миграций).
import { sql as pgSql } from 'drizzle-orm'
import { db, sql } from './client.js'
import { markerSections, markerCatalog, markerOptimums, recommendationContent } from './schema.js'
import {
    MARKER_CATALOG,
    SECTION_TITLES,
    type OptRange,
} from '../modules/profile/optimums.js'
import {
    LIFESTYLE_PROGRAM,
    INFLAMMATION_FOODS,
    GLYCEMIC_TIPS,
    NUTRITION_PRINCIPLES,
    BITTER_TASTES,
    DESSERT_SWAPS,
    LIFEHACKS,
} from '../modules/profile/content.js'

const numStr = (n: number | null): string | null => (n === null ? null : String(n))

async function seedSections(): Promise<void> {
    const rows = Object.entries(SECTION_TITLES).map(([code, title], i) => ({
        code,
        title,
        sortOrder: i,
    }))
    await db
        .insert(markerSections)
        .values(rows)
        .onConflictDoUpdate({ target: markerSections.code, set: { title: pgSql`excluded.title` } })
}

async function seedCatalog(): Promise<void> {
    for (const entry of MARKER_CATALOG) {
        const [row] = await db
            .insert(markerCatalog)
            .values({
                key: entry.key,
                sectionCode: entry.section,
                display: entry.display,
                unit: entry.unit,
                aliases: entry.aliases,
            })
            .onConflictDoUpdate({
                target: markerCatalog.key,
                set: {
                    sectionCode: entry.section,
                    display: entry.display,
                    unit: entry.unit,
                    aliases: entry.aliases,
                },
            })
            .returning({ id: markerCatalog.id })

        if (!row) continue

        const genders: Array<['all' | 'male' | 'female', OptRange | undefined]> = [
            ['all', entry.optimum.all],
            ['male', entry.optimum.male],
            ['female', entry.optimum.female],
        ]
        for (const [gender, range] of genders) {
            if (!range) continue
            await db
                .insert(markerOptimums)
                .values({
                    catalogId: row.id,
                    gender,
                    optimumMin: numStr(range.min),
                    optimumMax: numStr(range.max),
                    unit: entry.unit,
                })
                .onConflictDoUpdate({
                    target: [markerOptimums.catalogId, markerOptimums.gender],
                    set: { optimumMin: numStr(range.min), optimumMax: numStr(range.max) },
                })
        }
    }
}

async function seedContent(): Promise<void> {
    const items: Array<{
        kind: string
        key: string
        title: string | null
        body: unknown
        sortOrder: number
    }> = []

    LIFESTYLE_PROGRAM.forEach((b, i) => {
        items.push({
            kind: 'program',
            key: `program.${b.key}`,
            title: b.title,
            body: { icon: b.icon, summary: b.summary, steps: b.steps, relevantTags: b.relevantTags },
            sortOrder: i,
        })
    })
    items.push({
        kind: 'food',
        key: 'food.inflammation',
        title: 'Противовоспалительный стол',
        body: INFLAMMATION_FOODS,
        sortOrder: 0,
    })
    items.push({
        kind: 'tip',
        key: 'tip.glycemic',
        title: 'Гликемический и инсулиновый индекс',
        body: { tips: GLYCEMIC_TIPS },
        sortOrder: 0,
    })
    items.push({
        kind: 'tip',
        key: 'tip.nutrition_principles',
        title: 'Принципы питания',
        body: { tips: NUTRITION_PRINCIPLES },
        sortOrder: 1,
    })
    items.push({
        kind: 'tip',
        key: 'tip.bitter_tastes',
        title: 'Горечи и вкусовые рецепторы',
        body: { tips: BITTER_TASTES },
        sortOrder: 2,
    })
    items.push({
        kind: 'food',
        key: 'food.dessert_swaps',
        title: 'Натуральные замены сладкому',
        body: { items: DESSERT_SWAPS },
        sortOrder: 1,
    })
    items.push({
        kind: 'tip',
        key: 'tip.lifehacks',
        title: 'Лайфхаки',
        body: { hacks: LIFEHACKS },
        sortOrder: 3,
    })

    for (const it of items) {
        await db
            .insert(recommendationContent)
            .values({ kind: it.kind, key: it.key, title: it.title, body: it.body, sortOrder: it.sortOrder })
            .onConflictDoUpdate({
                target: recommendationContent.key,
                set: { title: it.title, body: it.body, sortOrder: it.sortOrder, updatedAt: pgSql`now()` },
            })
    }
}

try {
    await seedSections()
    await seedCatalog()
    await seedContent()
    process.stdout.write(
        `Seed OK: ${Object.keys(SECTION_TITLES).length} sections, ${MARKER_CATALOG.length} catalog entries, content synced\n`
    )
} finally {
    await sql.end()
}
