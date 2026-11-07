import { useLayoutEffect, useRef, useState } from 'react'

const MAX_FONT = 14
const MIN_ONE_LINE_FONT = 10
const MIN_FONT = 7
const LINE_HEIGHT = 1.25

// 図形の枠（バウンディングボックス）からはみ出さないよう文字を自動調整する。
// 1. まず1行のまま縮小（10pxまで）
// 2. それでも入らなければ折り返して縮小（7pxまで）
// 3. 最小サイズでも入らなければ、入る行数で打ち切って末尾を「…」にする
export default function FitLabel({ text, width, height }) {
  const boxRef = useRef(null)
  const [fit, setFit] = useState({ fontSize: MAX_FONT, wrap: false, clampLines: null })

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const overflows = () => box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight
    const shrinkUntilFits = (minSize) => {
      let size = MAX_FONT
      box.style.fontSize = `${size}px`
      while (size > minSize && overflows()) {
        size -= 1
        box.style.fontSize = `${size}px`
      }
      return size
    }
    box.style.display = ''
    box.style.webkitLineClamp = ''

    box.style.whiteSpace = 'nowrap'
    let size = shrinkUntilFits(MIN_ONE_LINE_FONT)
    if (!overflows()) {
      setFit({ fontSize: size, wrap: false, clampLines: null })
      return
    }
    box.style.whiteSpace = 'normal'
    size = shrinkUntilFits(MIN_FONT)
    const clampLines = overflows() ? Math.max(1, Math.floor((height - 12) / (size * LINE_HEIGHT))) : null
    setFit({ fontSize: size, wrap: true, clampLines })
  }, [text, width, height])

  const style = {
    fontSize: fit.fontSize,
    lineHeight: LINE_HEIGHT,
    whiteSpace: fit.wrap ? 'normal' : 'nowrap',
    ...(fit.clampLines
      ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: fit.clampLines }
      : {}),
  }

  return (
    <div className="floor-plan-canvas__label-wrap" style={{ width, height }}>
      <div ref={boxRef} className="floor-plan-canvas__label" style={style}>
        {text}
      </div>
    </div>
  )
}
