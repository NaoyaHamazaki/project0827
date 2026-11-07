import { useRef } from 'react'

// クリックで1マス切り替え、ドラッグで塗りつぶし／消去（押し始めたマスの状態で決まる）
export default function DrawingGrid({ grid, vertexCells, onChange }) {
  const svgRef = useRef(null)
  const paintRef = useRef(null)
  const size = grid.length
  const vertexKeys = new Set((vertexCells || []).map(([r, c]) => `${r},${c}`))

  const cellFromEvent = (event) => {
    const rect = svgRef.current.getBoundingClientRect()
    const c = Math.floor(((event.clientX - rect.left) / rect.width) * size)
    const r = Math.floor(((event.clientY - rect.top) / rect.height) * size)
    if (r < 0 || r >= size || c < 0 || c >= size) return null
    return [r, c]
  }

  const paint = (cell, value) => {
    const [r, c] = cell
    if (grid[r][c] === value) return
    onChange((current) => current.map((row, ri) => (
      ri === r ? row.map((v, ci) => (ci === c ? value : v)) : row
    )))
  }

  const handlePointerDown = (event) => {
    const cell = cellFromEvent(event)
    if (!cell) return
    event.currentTarget.setPointerCapture(event.pointerId)
    paintRef.current = !grid[cell[0]][cell[1]]
    paint(cell, paintRef.current)
  }

  const handlePointerMove = (event) => {
    if (paintRef.current === null) return
    const cell = cellFromEvent(event)
    if (cell) paint(cell, paintRef.current)
  }

  const stopPainting = () => { paintRef.current = null }

  return (
    <svg
      ref={svgRef}
      className="floor-plan-grid"
      viewBox={`0 0 ${size} ${size}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopPainting}
      onPointerCancel={stopPainting}
      role="grid"
      aria-label="描画用マス目"
    >
      {grid.map((row, r) => row.map((selected, c) => {
        const cls = vertexKeys.has(`${r},${c}`) ? 'is-vertex' : selected ? 'is-selected' : ''
        return (
          <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} className={`floor-plan-grid__cell ${cls}`} />
        )
      }))}
    </svg>
  )
}
