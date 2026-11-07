import { useRef, useState } from 'react'
import FitLabel from './FitLabel'

export const CANVAS_COLS = 40
export const CANVAS_ROWS = 28
export const CELL_PX = 20

const EDGE_LABEL_OFFSET_PX = 14

const toPx = (points) => points.map(([x, y]) => `${x * CELL_PX},${y * CELL_PX}`).join(' ')
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

const formatLength = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

// 図形の各辺の中点から外向きにオフセットした位置へ、辺の長さ（マス数）ラベルを置く
function edgeLengthLabels(points) {
  const n = points.length
  const centroid = points.reduce((acc, [x, y]) => [acc[0] + x / n, acc[1] + y / n], [0, 0])
  return points.map(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % n]
    const length = Math.hypot(x2 - x1, y2 - y1)
    const midX = ((x1 + x2) / 2) * CELL_PX
    const midY = ((y1 + y2) / 2) * CELL_PX
    const dirX = midX - centroid[0] * CELL_PX
    const dirY = midY - centroid[1] * CELL_PX
    const dirLen = Math.hypot(dirX, dirY) || 1
    return {
      key: i,
      x: midX + (dirX / dirLen) * EDGE_LABEL_OFFSET_PX,
      y: midY + (dirY / dirLen) * EDGE_LABEL_OFFSET_PX,
      text: formatLength(length),
    }
  })
}

/**
 * 右側の配置エリア。
 * - edit: 図形をドラッグして配置（1マス単位でスナップ）。クリックで選択
 * - view: 移動不可。ホバーで少し拡大、クリックで onShapeClick
 * どちらのモードでもホバー中の図形には、辺ごとの長さ（マス数）を表示する
 */
export default function FloorPlanCanvas({ shapes, mode, selectedId, onSelect, onMove, onShapeClick }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const width = CANVAS_COLS * CELL_PX
  const height = CANVAS_ROWS * CELL_PX

  const pointerCell = (event) => {
    const rect = svgRef.current.getBoundingClientRect()
    return [(event.clientX - rect.left) / CELL_PX, (event.clientY - rect.top) / CELL_PX]
  }

  const handleShapePointerDown = (event, shape) => {
    if (mode !== 'edit') return
    event.stopPropagation()
    const [px, py] = pointerCell(event)
    dragRef.current = { id: shape.id, offsetX: px - shape.x, offsetY: py - shape.y }
    svgRef.current.setPointerCapture(event.pointerId)
    setDraggingId(shape.id)
    onSelect(shape.id)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const shape = shapes.find((s) => s.id === drag.id)
    const [px, py] = pointerCell(event)
    const x = clamp(Math.round(px - drag.offsetX), 0, CANVAS_COLS - shape.width)
    const y = clamp(Math.round(py - drag.offsetY), 0, CANVAS_ROWS - shape.height)
    if (x !== shape.x || y !== shape.y) onMove(shape.id, x, y)
  }

  const endDrag = () => {
    dragRef.current = null
    setDraggingId(null)
  }

  return (
    <div className={`floor-plan-canvas floor-plan-canvas--${mode}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={() => mode === 'edit' && onSelect(null)}
      >
        <defs>
          <pattern id="floor-plan-grid-pattern" width={CELL_PX} height={CELL_PX} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL_PX} 0 L 0 0 0 ${CELL_PX}`} className="floor-plan-canvas__grid-line" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={mode === 'edit' ? 'url(#floor-plan-grid-pattern)' : '#fff'} />
        {shapes.map((shape) => (
          <g key={shape.id} transform={`translate(${shape.x * CELL_PX} ${shape.y * CELL_PX})`}>
            {/* 拡大アニメーションは内側の g に当てる（外側の translate を CSS transform で上書きしないため） */}
            <g
              className={[
                'floor-plan-canvas__shape',
                selectedId === shape.id && mode === 'edit' ? 'is-selected' : '',
                draggingId === shape.id ? 'is-dragging' : '',
              ].join(' ')}
              onPointerDown={(event) => handleShapePointerDown(event, shape)}
              onClick={() => mode === 'view' && onShapeClick(shape)}
              onMouseEnter={() => setHoveredId(shape.id)}
              onMouseLeave={() => setHoveredId((current) => (current === shape.id ? null : current))}
            >
              {shape.name && <title>{shape.name}</title>}
              <polygon points={toPx(shape.points)} className="floor-plan-shape" />
              {shape.name && (
                <foreignObject width={shape.width * CELL_PX} height={shape.height * CELL_PX}>
                  <FitLabel text={shape.name} width={shape.width * CELL_PX} height={shape.height * CELL_PX} />
                </foreignObject>
              )}
            </g>
            {hoveredId === shape.id && (
              <g className="floor-plan-canvas__edge-labels">
                {edgeLengthLabels(shape.points).map((label) => (
                  <g key={label.key} transform={`translate(${label.x} ${label.y})`}>
                    <rect
                      x={-10 - label.text.length * 2.5} y={-8}
                      width={20 + label.text.length * 5} height={16}
                      rx={4}
                    />
                    <text textAnchor="middle" dominantBaseline="middle">{label.text}</text>
                  </g>
                ))}
              </g>
            )}
          </g>
        ))}
      </svg>
      {shapes.length === 0 && (
        <p className="floor-plan-canvas__empty">左のパネルで図形を作成し「この図を使用」を押すと、ここに配置されます</p>
      )}
    </div>
  )
}
