// マス目の選択状態（grid[row][col] = true/false）から、ギザギザのない多角形の頂点を求める。
// 座標はマスの角（グリッド交点）を単位とし、x=列方向・y=行方向（画面座標なので下向きが+）。

const DIRS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]]

export function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(false))
}

function emptyLike(grid) {
  return grid.map((row) => row.map(() => false))
}

function inBounds(grid, r, c) {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length
}

function largestComponent(grid) {
  const seen = emptyLike(grid)
  let best = []
  grid.forEach((row, r) => row.forEach((selected, c) => {
    if (!selected || seen[r][c]) return
    const cells = []
    const queue = [[r, c]]
    seen[r][c] = true
    while (queue.length) {
      const [cr, cc] = queue.pop()
      cells.push([cr, cc])
      for (const [dr, dc] of DIRS4) {
        const nr = cr + dr
        const nc = cc + dc
        if (inBounds(grid, nr, nc) && grid[nr][nc] && !seen[nr][nc]) {
          seen[nr][nc] = true
          queue.push([nr, nc])
        }
      }
    }
    if (cells.length > best.length) best = cells
  }))
  const result = emptyLike(grid)
  best.forEach(([r, c]) => { result[r][c] = true })
  return result
}

// 外周から辿れない空きマス（穴）を埋める。これにより外周がただ1本の輪郭になる
function fillHoles(grid) {
  const outside = emptyLike(grid)
  const queue = []
  grid.forEach((row, r) => row.forEach((selected, c) => {
    const onBorder = r === 0 || c === 0 || r === grid.length - 1 || c === row.length - 1
    if (onBorder && !selected) {
      outside[r][c] = true
      queue.push([r, c])
    }
  }))
  while (queue.length) {
    const [r, c] = queue.pop()
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr
      const nc = c + dc
      if (inBounds(grid, nr, nc) && !grid[nr][nc] && !outside[nr][nc]) {
        outside[nr][nc] = true
        queue.push([nr, nc])
      }
    }
  }
  return grid.map((row, r) => row.map((selected, c) => selected || !outside[r][c]))
}

function removeCollinear(points) {
  if (points.length <= 3) return points
  const n = points.length
  return points.filter((cur, i) => {
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const cross = (cur[0] - prev[0]) * (next[1] - cur[1]) - (cur[1] - prev[1]) * (next[0] - cur[0])
    return cross !== 0
  })
}

// 選択マスの外周を時計回り（画面上）に辿り、角の座標列を返す
function traceOutline(grid) {
  const key = (x, y) => `${x},${y}`
  const next = new Map()
  const isSel = (r, c) => inBounds(grid, r, c) && grid[r][c]
  let start = null
  grid.forEach((row, r) => row.forEach((selected, c) => {
    if (!selected) return
    if (!start) start = [c, r]
    if (!isSel(r - 1, c)) next.set(key(c, r), [c + 1, r])
    if (!isSel(r, c + 1)) next.set(key(c + 1, r), [c + 1, r + 1])
    if (!isSel(r + 1, c)) next.set(key(c + 1, r + 1), [c, r + 1])
    if (!isSel(r, c - 1)) next.set(key(c, r + 1), [c, r])
  }))
  if (!start) return []
  const points = []
  let [x, y] = start
  do {
    points.push([x, y]);
    [x, y] = next.get(key(x, y))
  } while ((x !== start[0] || y !== start[1]) && points.length <= next.size)
  return removeCollinear(points)
}

// 階段状（1マスずつずれる段差が2段以上続く）部分を、1本の斜めの直線に置き換える。
// 段差が1段だけの場合は意図的な凹凸（L字など）とみなしてそのまま残す。
function simplifyStaircases(points) {
  const n = points.length
  if (n < 6) return points
  const edges = points.map((p, i) => {
    const q = points[(i + 1) % n]
    const dx = q[0] - p[0]
    const dy = q[1] - p[1]
    return { orient: dx !== 0 ? 'H' : 'V', sign: Math.sign(dx || dy), len: Math.abs(dx || dy) }
  })
  const sameDir = (a, b) => a.orient === b.orient && a.sign === b.sign

  // 進行方向が一方向に揃った（単調な）辺の並びを切り出す。閉じた多角形なので必ず途切れる箇所がある
  const breakAt = edges.findIndex((e, i) => !sameDir(e, edges[(i - 2 + n) % n]))
  if (breakAt < 0) return points
  const order = Array.from({ length: n }, (_, k) => (breakAt - 1 + n + k) % n)
  const runs = []
  let current = [order[0], order[1]]
  for (let k = 2; k < n; k++) {
    const i = order[k]
    if (sameDir(edges[i], edges[current[current.length - 2]])) {
      current.push(i)
    } else {
      runs.push(current)
      current = [current[current.length - 1], i]
    }
  }
  if (sameDir(edges[order[0]], edges[current[current.length - 2]])) current.push(order[0])
  runs.push(current)

  const findStairs = (run, treadOrient) => {
    const stairs = []
    let seg = []
    const flush = () => {
      const treads = seg.filter((i) => edges[i].orient === treadOrient).length
      if (treads >= 2) stairs.push({ edges: seg, treadOrient })
      seg = []
    }
    run.forEach((i) => {
      if (edges[i].orient === treadOrient && edges[i].len !== 1) flush()
      else seg.push(i)
    })
    flush()
    return stairs
  }

  const used = new Set()
  const removed = new Set()
  runs.forEach((run) => {
    const covered = (stairs) => stairs.reduce((sum, s) => sum + s.edges.length, 0)
    const byH = findStairs(run, 'H')
    const byV = findStairs(run, 'V')
    const stairs = covered(byV) > covered(byH) ? byV : byH
    stairs.forEach(({ edges: stairEdges, treadOrient }) => {
      // 隣り合う単調区間と共有している端の辺は、先に処理した側に譲る
      let seg = [...stairEdges]
      while (seg.length && used.has(seg[0])) seg.shift()
      while (seg.length && used.has(seg[seg.length - 1])) seg.pop()
      if (seg.filter((i) => edges[i].orient === treadOrient).length < 2) return
      seg.forEach((i) => used.add(i))
      seg.slice(1).forEach((i) => removed.add(i))
    })
  })
  return removeCollinear(points.filter((_, i) => !removed.has(i)))
}

// 頂点が乗っているマス（画面上で頂点を強調表示するため）
function vertexCells(grid, points) {
  const cells = []
  points.forEach(([x, y]) => {
    const candidates = [[y, x], [y - 1, x - 1], [y - 1, x], [y, x - 1]]
    const hit = candidates.find(([r, c]) => inBounds(grid, r, c) && grid[r][c])
    if (hit) cells.push(hit)
  })
  return cells
}

/**
 * マス目の選択状態から図形を求める。
 * 戻り値の points は図形の左上を (0,0) に揃えたもの、cells は描画に使ったマス（穴埋め・最大連結成分のみ）
 */
export function detectPolygon(grid) {
  const cleaned = fillHoles(largestComponent(grid))
  const outline = traceOutline(cleaned)
  if (outline.length < 3) return null
  const points = simplifyStaircases(outline)
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return {
    points: points.map(([x, y]) => [x - minX, y - minY]),
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    cells: cleaned,
    vertexCells: vertexCells(cleaned, points),
  }
}
