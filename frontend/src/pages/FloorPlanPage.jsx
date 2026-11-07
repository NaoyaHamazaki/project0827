import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eraser } from 'lucide-react'
import { fetchAllRooms } from '../api/meetingRooms'
import DrawingGrid from '../components/floorplan/DrawingGrid'
import FloorPlanCanvas from '../components/floorplan/FloorPlanCanvas'
import ShapePreview from '../components/floorplan/ShapePreview'
import { useToast } from '../context/ToastContext'
import { createEmptyGrid, detectPolygon } from '../utils/floorPlanGeometry'
import './FloorPlanPage.css'

const GRID_SIZE = 12
const DEFAULT_HEIGHT = 250
const MODES = [
  { key: 'edit', label: '編集', ready: true },
  { key: 'view', label: '表示', ready: false },
  { key: '3d', label: '3D表示（試用）', ready: false },
]

export default function FloorPlanPage() {
  const { showToast } = useToast()
  const [rooms, setRooms] = useState([])
  const [grid, setGrid] = useState(() => createEmptyGrid(GRID_SIZE))
  const [drawn, setDrawn] = useState(null)
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  // バックエンド未接続のため、配置した図形は画面内の状態としてのみ保持（再読み込みで消える）
  const [shapes, setShapes] = useState([])
  const [mode, setMode] = useState('edit')

  useEffect(() => {
    fetchAllRooms().then(setRooms).catch(() => setRooms([]))
  }, [])

  const handleGridChange = (updater) => {
    setGrid(updater)
    setDrawn(null)
  }

  const handleDraw = () => {
    const result = detectPolygon(grid)
    if (!result) {
      showToast('マス目を1つ以上選択してください', 'error')
      return
    }
    setDrawn(result)
  }

  const handleRoomChange = (value) => {
    setRoomId(value)
    const room = rooms.find((r) => String(r.id) === value)
    if (room && !name.trim()) setName(room.name)
  }

  const handleUse = () => {
    const offset = shapes.length % 10
    setShapes((current) => [...current, {
      id: crypto.randomUUID(),
      name: name.trim(),
      roomId: roomId ? Number(roomId) : null,
      wallHeight: Number(height) || DEFAULT_HEIGHT,
      points: drawn.points,
      width: drawn.width,
      height: drawn.height,
      x: 1 + offset * 2,
      y: 1 + offset,
    }])
    setGrid(createEmptyGrid(GRID_SIZE))
    setDrawn(null)
    setName('')
    setRoomId('')
    setHeight(DEFAULT_HEIGHT)
  }

  const handleClear = () => {
    setGrid(createEmptyGrid(GRID_SIZE))
    setDrawn(null)
  }

  return (
    <div className="floor-plan-page">
      <div className="floor-plan-page__header">
        <Link to="/meeting-rooms/settings" className="floor-plan-page__back">
          <ArrowLeft size={16} />
          会議室設定に戻る
        </Link>
        <h1>間取り図の作成</h1>
      </div>

      <div className="floor-plan-page__body">
        <aside className="floor-plan-panel">
          <div className="floor-plan-panel__grid-head">
            <span>マス目をクリック・ドラッグして範囲を選択</span>
            <button type="button" className="floor-plan-panel__clear" onClick={handleClear}>
              <Eraser size={14} />
              クリア
            </button>
          </div>
          <DrawingGrid grid={grid} vertexCells={drawn?.vertexCells} onChange={handleGridChange} />
          <button type="button" className="btn btn-primary floor-plan-panel__draw" onClick={handleDraw}>
            描画
          </button>

          <ShapePreview shape={drawn} />

          <div className="floor-plan-panel__form">
            <div className="field">
              <label htmlFor="fp-name">名称</label>
              <input id="fp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 会議室1" />
            </div>
            <div className="field">
              <label htmlFor="fp-room">紐づけ</label>
              <select id="fp-room" value={roomId} onChange={(e) => handleRoomChange(e.target.value)}>
                <option value="">（紐づけなし）</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fp-height">高さ（任意・cm）</label>
              <input
                id="fp-height"
                type="number"
                min="1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary floor-plan-panel__use"
            onClick={handleUse}
            disabled={!drawn}
          >
            この図を使用
          </button>
        </aside>

        <section className="floor-plan-main">
          <div className="floor-plan-main__tabs" role="tablist">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                className={`floor-plan-main__tab ${mode === m.key ? 'is-active' : ''}`}
                onClick={() => setMode(m.key)}
                disabled={!m.ready}
                title={m.ready ? undefined : '次のステップで実装予定'}
              >
                {m.label}
              </button>
            ))}
          </div>
          <FloorPlanCanvas shapes={shapes} />
        </section>
      </div>
    </div>
  )
}
