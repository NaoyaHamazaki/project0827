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

  const lastCellRef = useRef(null)

  const paint = (cells, value) => {
    const keys = new Set(cells.map(([r, c]) => `${r},${c}`))
    onChange((current) => current.map((row, r) => row.map((v, c) => (keys.has(`${r},${c}`) ? value : v))))
  }

  // ポインタ移動イベントの間隔が空いても途中のマスを飛ばさないよう、前回位置から直線補間する
  const cellsBetween = ([r0, c0], [r1, c1]) => {
    const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0))
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = steps === 0 ? 0 : i / steps
      return [Math.round(r0 + (r1 - r0) * t), Math.round(c0 + (c1 - c0) * t)]
    })
  }

  const handlePointerDown = (event) => {
    const cell = cellFromEvent(event)
    if (!cell) return
    event.currentTarget.setPointerCapture(event.pointerId)
    paintRef.current = !grid[cell[0]][cell[1]]
    lastCellRef.current = cell
    paint([cell], paintRef.current)
  }

  const handlePointerMove = (event) => {
    if (paintRef.current === null) return
    const cell = cellFromEvent(event)
    if (!cell) return
    const last = lastCellRef.current
    if (last && last[0] === cell[0] && last[1] === cell[1]) return
    paint(cellsBetween(last || cell, cell), paintRef.current)
    lastCellRef.current = cell
  }

  const stopPainting = () => {
    paintRef.current = null
    lastCellRef.current = null
  }

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
