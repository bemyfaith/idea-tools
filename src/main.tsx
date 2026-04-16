import React, { useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Download, ImagePlus, Move, RotateCcw, Trash2 } from 'lucide-react'
import { Rnd } from 'react-rnd'
import { toPng } from 'html-to-image'
import './style.css'

type CanvasItem = {
  id: string
  name: string
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

const uid = () => Math.random().toString(36).slice(2, 10)

function App() {
  const [items, setItems] = useState<CanvasItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  )

  const addFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    const loaded = await Promise.all(
      imageFiles.map(async (file, index) => {
        const src = URL.createObjectURL(file)
        return {
          id: uid(),
          name: file.name,
          src,
          x: 24 + index * 24,
          y: 24 + index * 24,
          width: 180,
          height: 180,
          rotation: 0,
        }
      }),
    )

    setItems((prev) => [...prev, ...loaded])
    setSelectedId(loaded[loaded.length - 1]?.id ?? null)
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const updateItem = (id: string, patch: Partial<CanvasItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const exportPng = async () => {
    if (!stageRef.current) return
    setLoading(true)
    try {
      const dataUrl = await toPng(stageRef.current, { cacheBust: true, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `idea-tools-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">IT</div>
          <div>
            <h1>Idea Tools</h1>
            <p>本地图片拖拽编辑器</p>
          </div>
        </div>

        <button className="primary" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={16} />
          导入本地图片
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onUpload}
        />

        <div className="panel">
          <div className="panel-title">图片列表</div>
          {items.length === 0 ? (
            <div className="empty">还没有图片，先导入几张本地图片。</div>
          ) : (
            <div className="asset-list">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`asset-card ${selectedId === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <img src={item.src} alt={item.name} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="panel">
            <div className="panel-title">属性面板</div>
            <label>
              宽度
              <input
                type="range"
                min="60"
                max="520"
                value={selected.width}
                onChange={(e) => updateItem(selected.id, { width: Number(e.target.value) })}
              />
            </label>
            <label>
              高度
              <input
                type="range"
                min="60"
                max="520"
                value={selected.height}
                onChange={(e) => updateItem(selected.id, { height: Number(e.target.value) })}
              />
            </label>
            <label>
              旋转
              <input
                type="range"
                min="-180"
                max="180"
                value={selected.rotation}
                onChange={(e) => updateItem(selected.id, { rotation: Number(e.target.value) })}
              />
            </label>
            <div className="row-actions">
              <button onClick={() => updateItem(selected.id, { rotation: 0 })}>
                <RotateCcw size={16} />
                重置旋转
              </button>
              <button className="danger" onClick={() => removeItem(selected.id)}>
                <Trash2 size={16} />
                删除
              </button>
            </div>
          </div>
        )}

        <div className="panel hint">
          <div className="panel-title">说明</div>
          <p>1. 选择本地图片</p>
          <p>2. 在画布里拖动、缩放、旋转</p>
          <p>3. 点击右上角导出 PNG</p>
          <p>4. 不上传服务器，全部只在本地浏览器里处理</p>
        </div>
      </aside>

      <main className="workspace">
        <div className="toolbar">
          <div className="toolbar-left">
            <Move size={16} />
            画布编辑区
          </div>
          <button className="primary" disabled={loading} onClick={exportPng}>
            <Download size={16} />
            {loading ? '导出中...' : '导出 PNG'}
          </button>
        </div>

        <div className="stage-wrap">
          <div
            ref={stageRef}
            className="stage"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
            }}
          >
            {items.length === 0 && <div className="stage-empty">把本地图片拖进来，或者点击左侧导入。</div>}

            {items.map((item) => (
              <Rnd
                key={item.id}
                size={{ width: item.width, height: item.height }}
                position={{ x: item.x, y: item.y }}
                onDragStop={(_, data) => updateItem(item.id, { x: data.x, y: data.y })}
                onResizeStop={(_, __, ref, ___, position) => {
                  updateItem(item.id, {
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                    ...position,
                  })
                }}
                bounds="parent"
                onMouseDown={() => setSelectedId(item.id)}
                className={`item ${selectedId === item.id ? 'selected' : ''}`}
              >
                <div className="item-frame" style={{ transform: `rotate(${item.rotation}deg)` }}>
                  <img src={item.src} alt={item.name} draggable={false} />
                  <div className="item-label">{item.name}</div>
                </div>
              </Rnd>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
