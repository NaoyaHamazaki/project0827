import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CANVAS_COLS, CANVAS_ROWS } from './FloorPlanCanvas'

// 1マス = 1m とみなし、入力された高さ(cm)を同じ縮尺に換算する
const CELL_CM = 100
const ROOM_COLOR = '#1b6082'
const ROOM_HOVER_COLOR = '#2b85b0'

// 名称ラベル。文字を2Dキャンバスに描いてテクスチャ化し、常にカメラを向くスプライトとして表示する
// （DOMを重ねる方式は React 19 の開発モードでルートの二重生成・破棄エラーが出るため使わない）
function LabelSprite({ text, position }) {
  const { texture, aspect } = useMemo(() => {
    const fontPx = 48
    const pad = 16
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const font = `${fontPx}px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`
    ctx.font = font
    const textWidth = Math.ceil(ctx.measureText(text).width)
    canvas.width = textWidth + pad * 2
    canvas.height = fontPx + pad * 2
    ctx.font = font
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
    ctx.fillStyle = '#222222'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, pad, canvas.height / 2 + 2)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return { texture: tex, aspect: canvas.width / canvas.height }
  }, [text])

  const height = 0.9
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  )
}

function RoomBlock({ shape, onClick }) {
  const [hovered, setHovered] = useState(false)
  const wall = shape.wallHeight / CELL_CM

  // 平面座標 (x, y) を XY 平面の Shape にし、Z 方向へ押し出してから X 軸で -90° 回転させて立てる。
  // 回転後は 平面x → ワールドX、平面y → ワールドZ、押し出し → ワールドY（上方向）になる
  const geometry = useMemo(() => {
    const outline = new THREE.Shape()
    shape.points.forEach(([x, y], i) => {
      const px = x + shape.x
      const py = -(y + shape.y)
      if (i === 0) outline.moveTo(px, py)
      else outline.lineTo(px, py)
    })
    outline.closePath()
    return new THREE.ExtrudeGeometry(outline, { depth: wall, bevelEnabled: false })
  }, [shape.points, shape.x, shape.y, wall])

  const center = [shape.x + shape.width / 2, wall + 0.3, shape.y + shape.height / 2]

  return (
    <group>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = '' }}
        onClick={(e) => { e.stopPropagation(); onClick(shape) }}
      >
        <meshStandardMaterial color={hovered ? ROOM_HOVER_COLOR : ROOM_COLOR} transparent opacity={0.92} />
      </mesh>
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#0d3347" />
      </lineSegments>
      {shape.name && <LabelSprite text={shape.name} position={center} />}
    </group>
  )
}

// 2Dキャンバスと同じ 40×28 マスの床グリッド
function FloorGrid() {
  const geometry = useMemo(() => {
    const vertices = []
    for (let x = 0; x <= CANVAS_COLS; x++) vertices.push(x, 0, 0, x, 0, CANVAS_ROWS)
    for (let z = 0; z <= CANVAS_ROWS; z++) vertices.push(0, 0, z, CANVAS_COLS, 0, z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    return g
  }, [])
  return (
    <lineSegments geometry={geometry} position={[0, 0.01, 0]}>
      <lineBasicMaterial color="#e3e7ec" />
    </lineSegments>
  )
}

// 配置済みの図形全体が収まるよう、斜め上（バードビュー）からのカメラ位置と注視点を決める
function frameShapes(shapes) {
  if (shapes.length === 0) {
    return { target: [CANVAS_COLS / 2, 0, CANVAS_ROWS / 2], size: CANVAS_COLS }
  }
  const minX = Math.min(...shapes.map((s) => s.x))
  const minZ = Math.min(...shapes.map((s) => s.y))
  const maxX = Math.max(...shapes.map((s) => s.x + s.width))
  const maxZ = Math.max(...shapes.map((s) => s.y + s.height))
  return {
    target: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    size: Math.max(maxX - minX, maxZ - minZ, 8),
  }
}

export default function FloorPlan3D({ shapes, onShapeClick }) {
  // カメラはタブを開いた時点の配置で決める（以降はマウス操作に任せる）
  const [{ target, size }] = useState(() => frameShapes(shapes))
  const [tx, , tz] = target
  return (
    <div className="floor-plan-3d">
      <Canvas flat shadows camera={{ position: [tx + size * 0.35, size * 0.95, tz + size * 1.05], fov: 45 }}>
        <color attach="background" args={['#f4f6f9']} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[tx + 15, 30, tz + 10]} intensity={1.6} castShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CANVAS_COLS / 2, 0, CANVAS_ROWS / 2]} receiveShadow>
          <planeGeometry args={[CANVAS_COLS, CANVAS_ROWS]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <FloorGrid />
        {shapes.map((shape) => (
          <RoomBlock key={shape.id} shape={shape} onClick={onShapeClick} />
        ))}
        <OrbitControls target={target} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={80} />
      </Canvas>
      <p className="floor-plan-3d__hint">ドラッグで回転・右ドラッグで移動・ホイールで拡大縮小（1マス＝1mとして表示）</p>
    </div>
  )
}
