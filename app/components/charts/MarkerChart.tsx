'use client'

// Лёгкий SVG-график динамики маркера: линия значений + полоса оптимума.
// Без библиотек — полный контроль стиля под DS, мобайл-фёрст (растягивается на 100%).

type Point = { date: string; value: number }

const W = 320 // логическая ширина viewBox; рендер растягивается на 100%
const PAD_X = 8
const PAD_Y = 14

function fmtVal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')
}

export default function MarkerChart({
  points,
  optimumMin,
  optimumMax,
  height = 96,
}: {
  points: Point[]
  optimumMin: number | null
  optimumMax: number | null
  height?: number
}) {
  if (points.length < 2) return null
  const H = height

  // Домен по Y: данные ∪ границы оптимума, + 12% отступа
  const values = points.map((p) => p.value)
  let lo = Math.min(...values, ...(optimumMin !== null ? [optimumMin] : []))
  let hi = Math.max(...values, ...(optimumMax !== null ? [optimumMax] : []))
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1
    hi += Math.abs(hi) * 0.1 || 1
  }
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad

  const x = (i: number) => PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2)
  const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - PAD_Y * 2)

  const inBand = (v: number) =>
    (optimumMin === null || v >= optimumMin) && (optimumMax === null || v <= optimumMax)

  // Полоса оптимума (обрезаем по домену)
  const bandTop = optimumMax !== null ? y(Math.min(optimumMax, hi)) : y(hi)
  const bandBottom = optimumMin !== null ? y(Math.max(optimumMin, lo)) : y(lo)
  const hasBand = optimumMin !== null || optimumMax !== null

  const polyline = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')

  const first = points[0]!
  const last = points[points.length - 1]!

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="График значений маркера"
      >
        {/* полоса оптимума */}
        {hasBand && (
          <rect
            x={PAD_X}
            y={bandTop}
            width={W - PAD_X * 2}
            height={Math.max(bandBottom - bandTop, 0)}
            rx={3}
            fill="rgba(150,210,140,0.10)"
            stroke="rgba(150,210,140,0.22)"
            strokeWidth={0.6}
          />
        )}

        {/* линия значений */}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* точки: зелёные в оптимуме, янтарные вне */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={i === points.length - 1 ? 4 : 3}
              fill={inBand(p.value) ? '#a8e0a0' : '#ffc850'}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={0.8}
            />
            {/* подписи значений: первая и последняя точки */}
            {(i === 0 || i === points.length - 1) && (
              <text
                x={x(i)}
                y={y(p.value) - 7}
                textAnchor={i === 0 ? 'start' : 'end'}
                fill="rgba(255,255,255,0.85)"
                fontSize={10.5}
                fontFamily="var(--font-sans)"
                fontWeight={600}
              >
                {fmtVal(p.value)}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* подписи дат под графиком */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: `2px ${(PAD_X / W) * 100}% 0`,
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        <span>{fmtDate(first.date)}</span>
        <span>{fmtDate(last.date)}</span>
      </div>
    </div>
  )
}
