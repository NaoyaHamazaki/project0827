export const CANVAS_COLS = 40
export const CANVAS_ROWS = 28
export const CELL_PX = 20

const toPx = (points) => points.map(([x, y]) => `${x * CELL_PX},${y * CELL_PX}`).join(' ')

// 右側の配置エリア。ステップ1では追加した図形を置いて表示するだけ（移動・モード別の挙動はステップ2で実装）
export default function FloorPlanCanvas({ shapes }) {
  const width = CANVAS_COLS * CELL_PX
  const height = CANVAS_ROWS * CELL_PX
  return (
    <div className="floor-plan-canvas">
      <svg width={width} height={height}>
        <defs>
          <pattern id="floor-plan-grid-pattern" width={CELL_PX} height={CELL_PX} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL_PX} 0 L 0 0 0 ${CELL_PX}`} className="floor-plan-canvas__grid-line" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#floor-plan-grid-pattern)" />
        {shapes.map((shape) => (
          <g key={shape.id} transform={`translate(${shape.x * CELL_PX} ${shape.y * CELL_PX})`}>
            <polygon points={toPx(shape.points)} className="floor-plan-shape" />
            {shape.name && (
              <foreignObject width={shape.width * CELL_PX} height={shape.height * CELL_PX}>
                <div className="floor-plan-canvas__label-wrap">
                  <span className="floor-plan-canvas__label">{shape.name}</span>
                </div>
              </foreignObject>
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
