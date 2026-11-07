// 判定した頂点で図形をプレビュー表示する（図形の大きさに合わせて枠いっぱいに拡大）
export default function ShapePreview({ shape }) {
  if (!shape) {
    return (
      <div className="floor-plan-preview floor-plan-preview--empty">
        マス目を選んで「描画」を押すと、ここに図形が表示されます
      </div>
    )
  }
  const pad = Math.max(shape.width, shape.height) * 0.12
  const viewBox = `${-pad} ${-pad} ${shape.width + pad * 2} ${shape.height + pad * 2}`
  return (
    <div className="floor-plan-preview">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <polygon points={shape.points.map((p) => p.join(',')).join(' ')} className="floor-plan-shape" />
      </svg>
    </div>
  )
}
