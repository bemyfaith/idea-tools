import React, { useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Download, ImagePlus, Move, RotateCcw, LayoutTemplate, AlignCenter, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Rnd } from 'react-rnd'
import { toPng } from 'html-to-image'
import './style.css'

type RankCategory = { id: string; label: string; color: string; textColor: string; textSize: number; track: string }
type TemplateId = 'video' | 'clean'
type Template = { id: TemplateId; name: string; description: string; stageClass: string; railClass: string; itemClass: string; defaultPositions: Array<{ x: number; y: number }>; showRightDividers: boolean }
type CanvasItem = { id: string; name: string; src: string; x: number; y: number; width: number; height: number; rotation: number; categoryId: string; sourceId: string; revealState: 'searching' | 'revealed'; isPreview?: boolean }
type TemplateState = { library: CanvasItem[]; items: CanvasItem[] }

const INITIAL_RANK_CATEGORIES_VIDEO: RankCategory[] = [
  { id: 'han', label: '夯', color: '#e63223', textColor: '#ffffff', textSize: 30, track: '#e63223' },
  { id: 'dingji', label: '顶级', color: '#f3c744', textColor: '#ffffff', textSize: 30, track: '#f3c744' },
  { id: 'renshangren', label: '人上人', color: '#fffb53', textColor: '#111827', textSize: 30, track: '#fffb53' },
  { id: 'npc', label: 'npc', color: '#faeed0', textColor: '#111827', textSize: 30, track: '#faeed0' },
  { id: 'lawanle', label: '拉完了', color: '#ffffff', textColor: '#111827', textSize: 30, track: '#ffffff' },
]

const INITIAL_RANK_CATEGORIES_CLEAN: RankCategory[] = [
  { id: 'han', label: '夯', color: '#4b2e33', textColor: '#979797', textSize: 30, track: '#4b2e33' },
  { id: 'dingji', label: '顶级', color: '#332b26', textColor: '#979797', textSize: 30, track: '#332b26' },
  { id: 'renshangren', label: '人上人', color: '#24242f', textColor: '#979797', textSize: 30, track: '#24242f' },
  { id: 'npc', label: 'npc', color: '#242d3b', textColor: '#979797', textSize: 30, track: '#242d3b' },
  { id: 'lawanle', label: '拉完了', color: '#19231e', textColor: '#979797', textSize: 30, track: '#19231e' },
]

const INITIAL_TEMPLATES: Template[] = [
  { id: 'clean', name: '三角洲风格', description: '更干净的画布风格', stageClass: 'template-clean', railClass: 'template-clean-rail', itemClass: 'template-clean-item', defaultPositions: [{ x: 120, y: 100 }, { x: 340, y: 100 }, { x: 560, y: 100 }, { x: 780, y: 100 }, { x: 1000, y: 100 }], showRightDividers: true },
  { id: 'video', name: '视频同款', description: '默认排行 UI，适合录屏', stageClass: 'template-video', railClass: 'template-video-rail', itemClass: 'template-video-item', defaultPositions: [{ x: 176, y: 34 }, { x: 416, y: 34 }, { x: 656, y: 34 }, { x: 896, y: 34 }, { x: 1136, y: 34 }], showRightDividers: true },
]
const uid = () => Math.random().toString(36).slice(2, 10)
const SEARCH_REVEAL_MS = 2600
const RANK_RAIL_WIDTH = 141
const RANK_ROW_PADDING = 14
const HORIZONTAL_STAGGER = 0

const createCanvasItem = (item: Omit<CanvasItem, 'id' | 'revealState'>, revealState: CanvasItem['revealState'] = 'searching'): CanvasItem => ({
  ...item,
  id: uid(),
  revealState,
})

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      if (typeof (img as HTMLImageElement).decode === 'function') {
        return (img as HTMLImageElement).decode().catch(() => undefined)
      }
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )
}

function App() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES)
  const [rankCategories, setRankCategories] = useState<RankCategory[]>(INITIAL_RANK_CATEGORIES_VIDEO)
  const [templateId, setTemplateId] = useState<TemplateId>('video')
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#191c1f')
  const [templateState, setTemplateState] = useState<Record<TemplateId, TemplateState>>({
    clean: { library: [], items: [] },
    video: { library: [], items: [] },
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [flyingBack, setFlyingBack] = useState<{ itemId: string; src: string; x: number; y: number; w: number; h: number } | null>(null)
  const [flyingToLayer, setFlyingToLayer] = useState<{ itemId: string; src: string; x: number; y: number; w: number; h: number } | null>(null)
  const revealTimersRef = useRef<number[]>([])
  const stageRef = useRef<HTMLDivElement | null>(null)
  const libraryRef = useRef<HTMLDivElement | null>(null)
  const singleInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  const template = useMemo(() => templates.find((item) => item.id === templateId) ?? templates[0], [templates, templateId])
  const currentState = templateState[templateId]
  const { library, items } = currentState
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId])
  const available = library

  const clearRevealTimers = () => {
    revealTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    revealTimersRef.current = []
  }

  const scheduleReveal = (itemId: string) => {
    const timerId = window.setTimeout(() => {
      setTemplateState((prev) => ({
        ...prev,
        [templateId]: {
          ...prev[templateId],
          items: prev[templateId].items.map((item) => (item.id === itemId ? { ...item, revealState: 'revealed' } : item)),
        },
      }))
      revealTimersRef.current = revealTimersRef.current.filter((id) => id !== timerId)
    }, SEARCH_REVEAL_MS)
    revealTimersRef.current.push(timerId)
  }

  React.useEffect(() => () => clearRevealTimers(), [])

  const makeLibraryItem = (fileName: string, src: string, posIndex: number) => {
    const pos = template.defaultPositions[posIndex % template.defaultPositions.length]
    return createCanvasItem({ name: fileName, src, x: pos.x, y: pos.y, width: 180, height: 180, rotation: 0, categoryId: rankCategories[posIndex % rankCategories.length].id, sourceId: uid(), isPreview: false })
  }

  const previewLibraryItem = (item: CanvasItem) => {
    const stageBox = stageRef.current?.getBoundingClientRect()
    if (!stageBox) return
    const width = Math.min(340, stageBox.width * 0.28)
    const height = width
    const nextItem = createCanvasItem({
      name: item.name,
      src: item.src,
      x: (stageBox.width - width) / 2,
      y: (stageBox.height - height) / 2 - 30,
      width,
      height,
      rotation: 0,
      categoryId: item.categoryId,
      sourceId: item.sourceId,
      isPreview: true,
    }, 'searching')
    setTemplateState((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], items: [...prev[templateId].items, nextItem] },
    }))
    setSelectedId(nextItem.id)
  }

  const addFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return
    const readAsDataURL = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error ?? new Error('read file failed'))
        reader.readAsDataURL(file)
      })
    const loaded = await Promise.all(
      imageFiles.map(async (file, index) => {
        const src = await readAsDataURL(file)
        return makeLibraryItem(file.name, src, index)
      }),
    )
    setTemplateState((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        library: [...prev[templateId].library, ...loaded],
      },
    }))
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }
  const removeItem = (id: string) => { setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: prev[templateId].items.filter((item) => item.id !== id) } })); if (selectedId === id) setSelectedId(null) }
  const updateItem = (id: string, patch: Partial<CanvasItem>) => setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: prev[templateId].items.map((item) => (item.id === id ? { ...item, ...patch } : item)) } }))
  const getCategoryTarget = (categoryId: string, aspectWidth: number, aspectHeight: number) => {
    const idx = rankCategories.findIndex((category) => category.id === categoryId)
    const stageBox = stageRef.current?.getBoundingClientRect()
    const rowHeight = (stageBox?.height ?? 640) / Math.max(rankCategories.length, 1)
    const targetHeight = Math.max(96, rowHeight - RANK_ROW_PADDING * 2)
    const targetWidth = Math.max(120, targetHeight * (aspectWidth / Math.max(aspectHeight, 1)))
    return { x: RANK_RAIL_WIDTH + 20, y: idx * rowHeight + (rowHeight - targetHeight) / 2, width: targetWidth, height: targetHeight, rowHeight }
  }
  const placeItem = (sourceId: string, x?: number, y?: number) => {
    const item = library.find((i) => i.sourceId === sourceId)
    if (!item) return
    setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], library: prev[templateId].library.filter((i) => i.sourceId !== sourceId) } }))
    const nextItem = { ...item, id: uid(), x: x ?? 180, y: y ?? 40, revealState: 'searching' as const }
    setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: [...prev[templateId].items, nextItem] } }))
    scheduleReveal(nextItem.id)
  }
  const moveSelectedToCategory = (itemId: string, nextCategoryId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const sameCategoryItems = items.filter((i) => i.categoryId === nextCategoryId && i.id !== itemId)
    const startEl = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null
    const stageBox = stageRef.current?.getBoundingClientRect()
    const targetBase = getCategoryTarget(nextCategoryId, item.width, item.height)
    const gap = 16
    const targetX = targetBase.x + sameCategoryItems.length * (targetBase.width + 12)
    const targetY = targetBase.y
    const width = targetBase.width
    const height = targetBase.height
    if (startEl && stageBox) {
      const from = startEl.getBoundingClientRect()
      setFlyingToLayer({ itemId, src: item.src, x: from.left, y: from.top, w: from.width, h: from.height })
      requestAnimationFrame(() => {
        setFlyingToLayer((prev) => prev ? { ...prev, x: stageBox.left + targetX, y: stageBox.top + targetY, w: width, h: height } : prev)
      })
      window.setTimeout(() => {
        updateItem(itemId, { categoryId: nextCategoryId, x: targetX, y: targetY, width, height, isPreview: false })
        setFlyingToLayer(null)
      }, 320)
      return
    }
    updateItem(itemId, { categoryId: nextCategoryId, x: targetX, y: targetY, width, height, isPreview: false })
  }

  const returnToLibrary = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const itemEl = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null
    const libraryEl = libraryRef.current
    if (!itemEl || !libraryEl) {
      setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: prev[templateId].items.filter((i) => i.id !== itemId), library: [...prev[templateId].library, { ...item, id: uid(), revealState: 'revealed' }] } }))
      if (selectedId === itemId) setSelectedId(null)
      return
    }
    const from = itemEl.getBoundingClientRect()
    const to = libraryEl.getBoundingClientRect()
    setFlyingBack({ itemId, src: item.src, x: from.left, y: from.top, w: from.width, h: from.height })
    requestAnimationFrame(() => {
      setFlyingBack((prev) => prev ? { ...prev, x: to.left + 16, y: to.top + 16, w: 56, h: 56 } : prev)
    })
    window.setTimeout(() => {
      setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: prev[templateId].items.filter((i) => i.id !== itemId), library: [...prev[templateId].library, { ...item, id: uid(), revealState: 'revealed' }] } }))
      if (selectedId === itemId) setSelectedId(null)
      setFlyingBack(null)
    }, 260)
  }

  const isOverLibrary = (left: number, top: number, width: number, height: number) => {
    const libraryBox = libraryRef.current?.getBoundingClientRect()
    const stageBox = stageRef.current?.getBoundingClientRect()
    if (!libraryBox || !stageBox) return false
    const absLeft = stageBox.left + left
    const absTop = stageBox.top + top
    const absRight = absLeft + width
    const absBottom = absTop + height
    return absRight >= libraryBox.left && absLeft <= libraryBox.right && absBottom >= libraryBox.top
  }

  const switchTemplate = (nextTemplateId: TemplateId) => {
    setTemplateId(nextTemplateId)
    setRankCategories(nextTemplateId === 'video' ? INITIAL_RANK_CATEGORIES_VIDEO : INITIAL_RANK_CATEGORIES_CLEAN)
  }

  const shiftSelected = (dx: number, dy: number) => { if (!selected) return; updateItem(selected.id, { x: selected.x + dx, y: selected.y + dy }) }
  const bringForward = () => { if (!selected) return; setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: ((list) => { const idx = list.findIndex((item) => item.id === selected.id); if (idx < 0 || idx === list.length - 1) return list; const next = [...list]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next })(prev[templateId].items) } })) }
  const sendBackward = () => { if (!selected) return; setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: ((list) => { const idx = list.findIndex((item) => item.id === selected.id); if (idx <= 0) return list; const next = [...list]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next })(prev[templateId].items) } })) }
  const alignCenter = () => { if (!selected) return; updateItem(selected.id, { x: 510 - selected.width / 2 }) }

  const exportPng = async () => {
    if (!stageRef.current) return
    setLoading(true)
    try {
      await waitForImages(stageRef.current)
      const dataUrl = await toPng(stageRef.current, { cacheBust: true, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `idea-tools-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('export png failed', error)
      alert('导出失败，打开控制台看看报错。')
    } finally {
      setLoading(false)
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-badge">IT</div><div><h1>Idea Tools</h1><p>本地图片拖拽编辑器</p></div></div>
      <div className="import-row">
        <button className="primary" onClick={() => singleInputRef.current?.click()}><ImagePlus size={16} />导入图片</button>
        <button className="primary secondary" onClick={() => folderInputRef.current?.click()}><ImagePlus size={16} />导入文件夹</button>
      </div>
      <input ref={singleInputRef} type="file" accept="image/*" multiple hidden onChange={onUpload} />
      <input ref={folderInputRef} type="file" accept="image/*" multiple hidden onChange={onUpload} {...({ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)} />
      <div className="panel"><div className="panel-title">模板切换</div><div className="template-list">{templates.map((item) => <button key={item.id} className={`template-card ${templateId === item.id ? 'active' : ''}`} onClick={() => switchTemplate(item.id)}><LayoutTemplate size={16} /><div><strong>{item.name}</strong><span>{item.description}</span></div></button>)}</div></div>
      <div className="panel"><div className="panel-title">画布编辑</div><div className="canvas-edit-row"><label className="toggle-row"><input type="checkbox" checked={template.showRightDividers} onChange={(e) => setTemplates((prev) => prev.map((item) => item.id === templateId ? { ...item, showRightDividers: e.target.checked } : item))} />分割线</label><div className="canvas-background-wrap"><div className="canvas-background-label">画布背景色</div><input className="canvas-background-input" type="color" value={canvasBackgroundColor} onChange={(e) => setCanvasBackgroundColor(e.target.value)} /></div></div></div>
      <div className="panel"><div className="panel-title">等级模板编辑</div>
        {rankCategories.map((category) => (
          <div key={category.id} className="rank-edit-row">
            <input className="rank-name-input" value={category.label} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, label: e.target.value } : item))} />
            <input className="rank-text-color-input" type="color" value={category.textColor} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, textColor: e.target.value } : item))} />
            <input className="rank-size-input" type="number" min="8" max="96" value={category.textSize} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, textSize: Number(e.target.value) } : item))} />
            <input className="rank-color-input" type="color" value={category.color} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, color: e.target.value, track: e.target.value } : item))} />
          </div>
        ))}
      </div>
      {selected && <div className="panel"><div className="panel-title">属性面板</div><label>分层<select value={selected.categoryId} onChange={(e) => moveSelectedToCategory(selected.id, e.target.value)}>{rankCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>宽度<input type="range" min="60" max="520" value={selected.width} onChange={(e) => updateItem(selected.id, { width: Number(e.target.value) })} /></label><label>高度<input type="range" min="60" max="520" value={selected.height} onChange={(e) => updateItem(selected.id, { height: Number(e.target.value) })} /></label><label>旋转<input type="range" min="-180" max="180" value={selected.rotation} onChange={(e) => updateItem(selected.id, { rotation: Number(e.target.value) })} /></label><div className="row-actions"><button onClick={() => updateItem(selected.id, { rotation: 0 })}><RotateCcw size={16} />重置旋转</button><button className="danger" onClick={() => removeItem(selected.id)}><Trash2 size={16} />删除</button></div></div>}
      {selected && <div className="panel"><div className="panel-title">图层 / 对齐</div><div className="row-actions"><button onClick={() => sendBackward()}><ChevronDown size={16} />下移</button><button onClick={() => bringForward()}><ChevronUp size={16} />上移</button></div><div className="row-actions" style={{ marginTop: 10 }}><button onClick={() => shiftSelected(-10, 0)}>←</button><button onClick={() => alignCenter()}><AlignCenter size={16} />居中</button><button onClick={() => shiftSelected(10, 0)}>→</button></div><div className="row-actions" style={{ marginTop: 10 }}><button onClick={() => shiftSelected(0, -10)}>↑</button><button onClick={() => shiftSelected(0, 10)}>↓</button></div></div>}
      <div className="panel hint"><div className="panel-title">说明</div><p>1. 选择模板</p><p>2. 可以直接导入本地图片或整个文件夹</p><p>3. 在画布里拖动、缩放、旋转</p><p>4. 不上传服务器，全部只在本地浏览器里处理</p></div>
    </aside>
    <main className="workspace"><div className="toolbar"><div className="toolbar-left"><Move size={16} />当前模板：{template.name}</div><button className="primary" disabled={loading} onClick={exportPng}><Download size={16} />{loading ? '导出中...' : '导出 PNG'}</button></div><div className="stage-wrap"><div ref={stageRef} className={`stage ${template.stageClass}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const sid = e.dataTransfer.getData('text/plain'); if (sid) { placeItem(sid); return } if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}><div className={`stage-rank-rail ${template.railClass}`}><div className="stage-rank-title-col">{rankCategories.map((category) => <div key={category.id} className="stage-rank-title" style={{ background: category.track, color: category.textColor, fontSize: `${category.textSize}px` }}>{category.label}</div>)}</div><div className={`stage-rank-grid ${template.showRightDividers ? '' : 'no-dividers'}`}>{rankCategories.map((category) => <div key={category.id} className="stage-rank-row" style={{ borderBottomColor: category.track }}><div className="stage-rank-area" style={{ background: canvasBackgroundColor }} /></div>)}</div></div>{items.map((item) => <Rnd key={item.id} size={{ width: item.width, height: item.height }} position={{ x: item.x, y: item.y }} onDragStop={(_, data) => { if (isOverLibrary(data.x, data.y, item.width, item.height)) { returnToLibrary(item.id); return } updateItem(item.id, { x: data.x, y: data.y }) }} onResizeStop={(_, __, ref, ___, position) => { updateItem(item.id, { width: ref.offsetWidth, height: ref.offsetHeight, ...position }) }} onMouseDown={() => setSelectedId(item.id)} data-item-id={item.id} className={`item ${template.itemClass} ${selectedId === item.id ? 'selected' : ''} ${templateId === 'clean' && item.revealState === 'searching' ? 'item-searching' : 'item-revealed'} ${item.isPreview ? 'item-preview' : ''}`}><div className="item-frame" style={{ transform: `rotate(${item.rotation}deg)` }}><img src={item.src} alt={item.name} draggable={false} />{templateId === 'clean' && <div className="item-search-overlay" aria-hidden="true"><div className="item-search-stripes" /><div className="item-search-magnifier"><div className="item-search-glass" /><div className="item-search-handle" /></div></div>}</div></Rnd>)}{flyingBack && <div className="flying-back" style={{ left: flyingBack.x, top: flyingBack.y, width: flyingBack.w, height: flyingBack.h }}><img src={flyingBack.src} alt="moving" /></div>}{flyingToLayer && <div className="flying-back flying-to-layer" style={{ left: flyingToLayer.x, top: flyingToLayer.y, width: flyingToLayer.w, height: flyingToLayer.h }}><img src={flyingToLayer.src} alt="moving to layer" /></div>}</div><div ref={libraryRef} className="library-panel"><div className="panel-title">素材库</div>{available.length === 0 ? <div className="empty">把图片导入到这里。</div> : <div className="asset-list asset-grid">{available.map((item) => <button key={item.sourceId} className="asset-card asset-card-image" draggable onClick={() => { previewLibraryItem(item); setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], library: prev[templateId].library.filter((i) => i.sourceId !== item.sourceId) } })) }} onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.sourceId) }}><img src={item.src} alt={item.name} /></button>)}</div>}</div></div></main></div>

}

ReactDOM.createRoot(document.getElementById('app')!).render(<React.StrictMode><App /></React.StrictMode>)
