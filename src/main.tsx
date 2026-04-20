import React, { useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Download, ImagePlus, Move, RotateCcw, LayoutTemplate, AlignCenter, Trash2, ChevronUp, ChevronDown, Wrench } from 'lucide-react'
import { Rnd } from 'react-rnd'
import { toPng } from 'html-to-image'
import './style.css'
import { SOUND_FILES } from './sound_data'

type RankCategory = { id: string; label: string; color: string; textColor: string; textSize: number; track: string }
type TemplateId = 'video' | 'clean'
type Template = { id: TemplateId; name: string; description: string; stageClass: string; railClass: string; itemClass: string; defaultPositions: Array<{ x: number; y: number }>; showRightDividers: boolean }
type CanvasItem = { id: string; name: string; src: string; x: number; y: number; width: number; height: number; rotation: number; categoryId: string; sourceId: string; revealState: 'searching' | 'revealed'; isPreview?: boolean; animationDuration?: number }
type TemplateState = { library: CanvasItem[]; items: CanvasItem[] }

const INITIAL_RANK_CATEGORIES_VIDEO: RankCategory[] = [
  { id: 'han', label: '夯', color: '#e63223', textColor: '#000000', textSize: 30, track: '#e63223' },
  { id: 'dingji', label: '顶级', color: '#f3c744', textColor: '#000000', textSize: 30, track: '#f3c744' },
  { id: 'renshangren', label: '人上人', color: '#fffb53', textColor: '#000000', textSize: 30, track: '#fffb53' },
  { id: 'npc', label: 'npc', color: '#faeed0', textColor: '#000000', textSize: 30, track: '#faeed0' },
  { id: 'lawanle', label: '拉完了', color: '#ffffff', textColor: '#000000', textSize: 30, track: '#ffffff' },
]

const INITIAL_RANK_CATEGORIES_CLEAN: RankCategory[] = [
  { id: 'han', label: '夯', color: '#4b2e33', textColor: '#979797', textSize: 30, track: '#4b2e33' },
  { id: 'dingji', label: '顶级', color: '#332b26', textColor: '#979797', textSize: 30, track: '#332b26' },
  { id: 'renshangren', label: '人上人', color: '#24242f', textColor: '#979797', textSize: 30, track: '#24242f' },
  { id: 'npc', label: 'npc', color: '#242d3b', textColor: '#979797', textSize: 30, track: '#242d3b' },
  { id: 'lawanle', label: '拉完了', color: '#19231e', textColor: '#979797', textSize: 30, track: '#19231e' },
]

const INITIAL_TEMPLATES: Template[] = [
  { id: 'clean', name: '三角洲风格', description: '', stageClass: 'template-clean', railClass: 'template-clean-rail', itemClass: 'template-clean-item', defaultPositions: [{ x: 120, y: 100 }, { x: 340, y: 100 }, { x: 560, y: 100 }, { x: 780, y: 100 }, { x: 1000, y: 100 }], showRightDividers: true },
  { id: 'video', name: '视频同款', description: '', stageClass: 'template-video', railClass: 'template-video-rail', itemClass: 'template-video-item', defaultPositions: [{ x: 176, y: 34 }, { x: 416, y: 34 }, { x: 656, y: 34 }, { x: 896, y: 34 }, { x: 1136, y: 34 }], showRightDividers: true },
]
const uid = () => Math.random().toString(36).slice(2, 10)
const SEARCH_REVEAL_MS = 2600
const RANK_RAIL_WIDTH = 141
const RANK_ROW_PADDING = 14
const HORIZONTAL_STAGGER = 0
const ROW_START_X = 160
const ROW_GAP = 10


type SoundBand = 'redgold' | 'purpleblue' | 'green'

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

function HomePage({ onOpen }: { onOpen: (path: string) => void }) {
  return <div className="home-shell">
    <div className="home-hero">
      <h1>✨有所梦_ 奇思妙想小工具站🎯</h1>
      <div className="home-cards">
        <button className="home-card home-card-wide" onClick={() => onOpen('/delta')}>
          <strong>🔍锐评从夯到拉模板</strong>
          <span>三角洲风格 · 搜索动画 / 音效 / 等级模板</span>
        </button>
      </div>
      <div className="home-copy">
        <p>共创计划：</p>
        <p>各位大人，up本身是一个程序员，可以熟练制作各种网页小工具等等互联网项目，各位大人如有奇思妙想的小主意可以告诉我，你来出💡主意我来开发。</p>
        <p>如决定开发的为免费小工具，我会在本网站及各种路径注明由我们一起共创，不会剽窃你的想法。</p>
        <p>如决定开发的为付费小工具，我会跟你一起分成且注明由你一起共创，具体细节还需要一起商定。</p>
      </div>
    </div>
  </div>
}

function App() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES)
  const [rankCategories, setRankCategories] = useState<RankCategory[]>(INITIAL_RANK_CATEGORIES_VIDEO)
  const [path, setPath] = useState(window.location.pathname)
  const [agreementOpen, setAgreementOpen] = useState(window.location.pathname === '/delta')
  const [templateId, setTemplateId] = useState<TemplateId>(window.location.pathname.startsWith('/video') ? 'video' : 'clean')
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#ffffff')
  const [deltaSearchEnabled, setDeltaSearchEnabled] = useState(true)
  const [deltaSearchDefaultDuration, setDeltaSearchDefaultDuration] = useState('2')
  const [soundSettings, setSoundSettings] = useState({ redgoldMin: '3', purpleblueMin: '1', greenMax: '1' })
  const [templateState, setTemplateState] = useState<Record<TemplateId, TemplateState>>({
    clean: { library: [], items: [] },
    video: { library: [], items: [] },
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [flyingBack, setFlyingBack] = useState<{ itemId: string; src: string; x: number; y: number; w: number; h: number } | null>(null)
  const [flyingToLayer, setFlyingToLayer] = useState<{ itemId: string; src: string; x: number; y: number; w: number; h: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sourceId: string } | null>(null)
  const [customDurationInput, setCustomDurationInput] = useState('')
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
  React.useEffect(() => { const close = () => setContextMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [])
  React.useEffect(() => { if (!contextMenu) setCustomDurationInput('') }, [contextMenu])
  React.useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  React.useEffect(() => {
    if (path === '/video') {
      switchTemplate('video')
      setAgreementOpen(false)
    } else if (path === '/delta') {
      switchTemplate('clean')
      setAgreementOpen(true)
    } else if (path === '/') {
      switchTemplate('clean')
      setAgreementOpen(false)
    }
  }, [path])

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  const makeLibraryItem = (fileName: string, src: string, posIndex: number) => {
    const pos = template.defaultPositions[posIndex % template.defaultPositions.length]
    return createCanvasItem({ name: fileName, src, x: pos.x, y: pos.y, width: 180, height: 180, rotation: 0, categoryId: '', sourceId: uid(), isPreview: false })
  }


  const getSoundBand = (seconds: number): SoundBand => {
    const greenMax = Number(soundSettings.greenMax) || 1
    const redgoldMin = Number(soundSettings.redgoldMin) || 3
    if (seconds >= redgoldMin) return 'redgold'
    if (seconds > greenMax) return 'purpleblue'
    return 'green'
  }

  const playSearchSound = async (animationSeconds: number) => {
    if (!deltaSearchEnabled || animationSeconds <= 0) return
    const band = getSoundBand(animationSeconds)
    const audio = new Audio(SOUND_FILES[band])
    audio.preload = 'auto'
    try {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => resolve()
        const onError = () => reject(new Error('audio load failed'))
        audio.addEventListener('loadedmetadata', onLoaded, { once: true })
        audio.addEventListener('error', onError, { once: true })
      })
      const audioDuration = audio.duration || 0
      const endOffset = 0.7
      const targetEnd = animationSeconds + endOffset
      const startDelay = Math.max(0, targetEnd - audioDuration)
      const startOffset = Math.max(0, audioDuration - targetEnd)
      if (startOffset > 0) audio.currentTime = startOffset
      window.setTimeout(async () => {
        try {
          await audio.play()
        } catch {
          // ignore audio failures
        }
      }, startDelay * 1000)
      window.setTimeout(() => { audio.pause(); audio.currentTime = 0 }, targetEnd * 1000)
    } catch {
      // ignore audio failures
    }
  }

  const previewLibraryItem = (sourceId: string) => {
    const item = library.find((entry) => entry.sourceId === sourceId)
    const stageBox = stageRef.current?.getBoundingClientRect()
    if (!item || !stageBox) return
    const width = Math.min(340, stageBox.width * 0.28)
    const height = width
    const currentDuration = (templateState[templateId].library.find((entry) => entry.sourceId === sourceId)?.animationDuration ?? Number(deltaSearchDefaultDuration)) || 3
    const nextItem = createCanvasItem({
      name: item.name,
      src: item.src,
      x: (stageBox.width - width) / 2,
      y: (stageBox.height - height) / 2 - 30,
      width,
      height,
      rotation: 0,
      categoryId: '',
      sourceId: item.sourceId,
      isPreview: true,
      animationDuration: deltaSearchEnabled ? currentDuration : 0,
    }, deltaSearchEnabled ? 'searching' : 'revealed')
    setTemplateState((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], items: [...prev[templateId].items, nextItem] },
    }))
    if (templateId === 'clean') {
      void playSearchSound(currentDuration)
      window.setTimeout(() => {
        setTemplateState((prev) => ({
          ...prev,
          [templateId]: {
            ...prev[templateId],
            items: prev[templateId].items.map((item) => item.id === nextItem.id ? { ...item, revealState: 'revealed', isPreview: false } : item),
          },
        }))
      }, currentDuration * 1000)
    }
    setSelectedId(nextItem.id)
  }

  const applyLibraryDuration = (sourceId: string, duration: number) => {
    setTemplateState((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        library: prev[templateId].library.map((item) => item.sourceId === sourceId ? { ...item, animationDuration: duration } : item),
        items: prev[templateId].items.map((item) => item.sourceId === sourceId ? { ...item, animationDuration: duration } : item),
      },
    }))
    setCustomDurationInput('')
    setContextMenu(null)
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
    return { x: ROW_START_X, y: idx * rowHeight + (rowHeight - targetHeight) / 2, width: targetWidth, height: targetHeight, rowHeight }
  }
  const placeItem = (sourceId: string, x?: number, y?: number) => {
    const item = library.find((i) => i.sourceId === sourceId)
    if (!item) return
    setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], library: prev[templateId].library.filter((i) => i.sourceId !== sourceId) } }))
    const nextItem = { ...item, id: uid(), x: x ?? 180, y: y ?? 40, categoryId: '', revealState: 'searching' as const }
    setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], items: [...prev[templateId].items, nextItem] } }))
    scheduleReveal(nextItem.id)
  }
  const relayoutCategory = (categoryId: string, movedItemId?: string) => {
    const categoryItems = items.filter((item) => item.categoryId === categoryId || item.id === movedItemId)
    const stageWidth = stageRef.current?.getBoundingClientRect().width ?? 1200
    const stageHeight = stageRef.current?.getBoundingClientRect().height ?? 640
    const idx = rankCategories.findIndex((category) => category.id === categoryId)
    const rowHeight = stageHeight / Math.max(rankCategories.length, 1)
    const targetHeight = Math.max(96, rowHeight - RANK_ROW_PADDING * 2)
    const y = idx * rowHeight + (rowHeight - targetHeight) / 2
    const baseWidth = Math.max(120, targetHeight * 1.25)
    const available = Math.max(0, stageWidth - ROW_START_X - 24)
    const totalGaps = Math.max(0, categoryItems.length - 1) * ROW_GAP
    const canFitFull = categoryItems.length * baseWidth + totalGaps <= available
    const width = canFitFull ? baseWidth : Math.max(72, Math.floor((available - totalGaps) / Math.max(categoryItems.length, 1)))
    const ordered = [...categoryItems].sort((a, b) => items.findIndex((x) => x.id === a.id) - items.findIndex((x) => x.id === b.id))
    return ordered.map((it, index) => ({ id: it.id, x: ROW_START_X + index * (width + ROW_GAP), y, width, height: targetHeight, categoryId }))
  }

  const moveSelectedToCategory = (itemId: string, nextCategoryId: string) => {
    if (!nextCategoryId) {
      updateItem(itemId, { categoryId: '', width: 180, height: 180 })
      return
    }
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const startEl = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null
    const stageBox = stageRef.current?.getBoundingClientRect()
    const nextLayout = relayoutCategory(nextCategoryId, itemId)
    const target = nextLayout.find((it) => it.id === itemId)
    if (!target) return
    const applyLayout = () => {
      setTemplateState((prev) => ({
        ...prev,
        [templateId]: {
          ...prev[templateId],
          items: prev[templateId].items.map((it) => {
            const layout = nextLayout.find((l) => l.id === it.id)
            return layout ? { ...it, categoryId: layout.categoryId, x: layout.x, y: layout.y, width: layout.width, height: layout.height, isPreview: false } : it
          }),
        },
      }))
    }
    if (startEl && stageBox) {
      const from = startEl.getBoundingClientRect()
      setTemplateState((prev) => ({
        ...prev,
        [templateId]: {
          ...prev[templateId],
          items: prev[templateId].items.map((it) => it.id === itemId ? { ...it, isPreview: true } : it),
        },
      }))
      setFlyingToLayer({ itemId, src: item.src, x: from.left, y: from.top, w: from.width, h: from.height })
      requestAnimationFrame(() => {
        setFlyingToLayer((prev) => prev ? { ...prev, x: stageBox.left + target.x, y: stageBox.top + target.y, w: target.width, h: target.height } : prev)
      })
      window.setTimeout(() => {
        setFlyingToLayer(null)
        applyLayout()
      }, 320)
      return
    }
    applyLayout()
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
    setCanvasBackgroundColor(nextTemplateId === 'video' ? '#ffffff' : 'rgb(24, 28, 31)')
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

  if (path === '/') return <HomePage onOpen={navigate} />

  return <div className="app-shell">
    {agreementOpen && path === '/delta' && <div className="agreement-backdrop" role="dialog" aria-modal="true"><div className="agreement-modal"><div className="agreement-title">君子协定</div><div className="agreement-body"><p>1. 由于网站有运营成本，所以本工具为【点赞投币关注后免费使用】，请陛下移步 <a href="https://space.bilibili.com/227403410?spm_id_from=333.788.0.0" target="_blank" rel="noreferrer">有所梦_</a> 。</p><p>2. 如对本工具有问题或者有定制需求，请【点赞投币关注】后加QQ群：1093037698 讨论。</p><p>3. 使用本工具制作图片及视频发布时，请注明工具来源，在b站@<a href="https://space.bilibili.com/227403410?spm_id_from=333.788.0.0" target="_blank" rel="noreferrer">有所梦_</a> 或者引用网站链接即可。</p></div><button className="agreement-button" onClick={() => setAgreementOpen(false)}>朕已阅</button></div></div>}
    <aside className="sidebar">
      <div className="brand"><div className="brand-badge"><Wrench size={22} strokeWidth={2.2} /></div><div><h1>从夯到拉锐评工具</h1><p><a href="https://space.bilibili.com/227403410?spm_id_from=333.788.0.0" target="_blank" rel="noreferrer">有所梦_ B站使用教程</a></p></div></div>
      <div className="import-row">
        <button className="primary" onClick={() => singleInputRef.current?.click()}><ImagePlus size={16} />导入图片</button>
        <button className="primary secondary" onClick={() => folderInputRef.current?.click()}><ImagePlus size={16} />导入文件夹</button>
      </div>
      <input ref={singleInputRef} type="file" accept="image/*" multiple hidden onChange={onUpload} />
      <input ref={folderInputRef} type="file" accept="image/*" multiple hidden onChange={onUpload} {...({ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)} />
      <div className="panel"><div className="panel-title">模板切换</div><div className="template-list">{templates.map((item) => <button key={item.id} className={`template-card ${templateId === item.id ? 'active' : ''}`} onClick={() => switchTemplate(item.id)}><LayoutTemplate size={16} /><div><strong>{item.name}</strong><span>{item.description}</span></div></button>)}</div></div>
      {selected && <div className="panel"><div className="panel-title">当前选中图片</div><label>等级<select value={selected.categoryId || ''} onChange={(e) => moveSelectedToCategory(selected.id, e.target.value)}><option value="">无</option>{rankCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><div className="row-actions"><button className="danger" onClick={() => removeItem(selected.id)}><Trash2 size={16} />删除</button></div></div>}
      {templateId === 'clean' && <div className="panel"><div className="panel-title">动画编辑</div><div className="settings-stack"><div className="setting-row"><label className="setting-label"><input type="checkbox" checked={deltaSearchEnabled} onChange={(e) => setDeltaSearchEnabled(e.target.checked)} />启用🔍动画</label></div><div className="setting-row"><div className="setting-label">🔍默认时长</div><div className="setting-inline"><input className="rank-size-input" type="number" min="0.5" step="0.1" value={deltaSearchDefaultDuration} onChange={(e) => setDeltaSearchDefaultDuration(e.target.value)} /><span>s</span></div></div><div className="setting-row"><div className="setting-label">红金音效</div><div className="setting-inline"><span>≥</span><input className="rank-size-input" type="number" min="0.5" step="0.1" value={soundSettings.redgoldMin} onChange={(e) => setSoundSettings((prev) => ({ ...prev, redgoldMin: e.target.value }))} /><span>s</span></div></div><div className="setting-row"><div className="setting-label">紫蓝音效</div><div className="setting-inline"><input className="rank-size-input" type="number" min="0.1" step="0.1" value={soundSettings.greenMax} onChange={(e) => setSoundSettings((prev) => ({ ...prev, greenMax: e.target.value }))} /><span>s -</span><input className="rank-size-input" type="number" min="0.1" step="0.1" value={soundSettings.redgoldMin} onChange={(e) => setSoundSettings((prev) => ({ ...prev, redgoldMin: e.target.value }))} /><span>s</span></div></div><div className="setting-row"><div className="setting-label">绿色音效</div><div className="setting-inline"><span>&le;</span><input className="rank-size-input" type="number" min="0.1" step="0.1" value={soundSettings.greenMax} onChange={(e) => setSoundSettings((prev) => ({ ...prev, greenMax: e.target.value }))} /><span>s</span></div></div></div></div>}
      <div className="panel"><div className="panel-title">等级模版编辑</div>
        <div className="canvas-edit-row"><label className="toggle-row"><input type="checkbox" checked={template.showRightDividers} onChange={(e) => setTemplates((prev) => prev.map((item) => item.id === templateId ? { ...item, showRightDividers: e.target.checked } : item))} />分割线</label><div className="canvas-background-wrap"><div className="canvas-background-label">画布背景色</div><input className="canvas-background-input canvas-background-input-round" type="color" value={canvasBackgroundColor} onChange={(e) => setCanvasBackgroundColor(e.target.value)} /></div></div>
        {rankCategories.map((category) => (
          <div key={category.id} className="rank-edit-row">
            <input className="rank-name-input" value={category.label} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, label: e.target.value } : item))} />
            <input className="rank-text-color-input" type="color" value={category.textColor} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, textColor: e.target.value } : item))} />
            <input className="rank-size-input" type="number" min="8" max="96" value={category.textSize} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, textSize: Number(e.target.value) } : item))} />
            <input className="rank-color-input" type="color" value={category.color} onChange={(e) => setRankCategories((prev) => prev.map((item) => item.id === category.id ? { ...item, color: e.target.value, track: e.target.value } : item))} />
          </div>
        ))}
      </div>
      {contextMenu && (() => { const current = (library.find((item) => item.sourceId === contextMenu.sourceId)?.animationDuration ?? Number(deltaSearchDefaultDuration)) || 3; return <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}><div className="context-menu-title">动画时长：{current}秒</div><div className="context-menu-input-row"><input autoFocus value={customDurationInput} onChange={(e) => setCustomDurationInput(e.target.value)} placeholder="填写秒数" onKeyDown={(e) => { if (e.key === 'Enter') { const seconds = Number(customDurationInput); if (!Number.isFinite(seconds) || seconds <= 0) return; applyLibraryDuration(contextMenu.sourceId, seconds) } }} /><button onClick={() => { const seconds = Number(customDurationInput); if (!Number.isFinite(seconds) || seconds <= 0) return; applyLibraryDuration(contextMenu.sourceId, seconds) }}>确定</button></div></div> })()}
    </aside>
    <main className="workspace"><div className="stage-wrap"><div ref={stageRef} className={`stage ${template.stageClass}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const sid = e.dataTransfer.getData('text/plain'); if (sid) { placeItem(sid); return } if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}><div className={`stage-rank-rail ${template.railClass}`}><div className="stage-rank-title-col">{rankCategories.map((category) => <div key={category.id} className="stage-rank-title" style={{ background: category.track, color: category.textColor, fontSize: `${category.textSize}px` }}>{category.label}</div>)}</div><div className={`stage-rank-grid ${template.showRightDividers ? '' : 'no-dividers'}`}>{rankCategories.map((category) => <div key={category.id} className="stage-rank-row" style={{ borderBottomColor: category.track }}><div className="stage-rank-area" style={{ background: canvasBackgroundColor }} /></div>)}</div></div>{items.map((item) => <Rnd key={item.id} size={{ width: item.width, height: item.height }} position={{ x: item.x, y: item.y }} onDragStop={(_, data) => { if (isOverLibrary(data.x, data.y, item.width, item.height)) { returnToLibrary(item.id); return } updateItem(item.id, { x: data.x, y: data.y }) }} onResizeStop={(_, __, ref, ___, position) => { updateItem(item.id, { width: ref.offsetWidth, height: ref.offsetHeight, ...position }) }} onMouseDown={() => setSelectedId(item.id)} data-item-id={item.id} className={`item ${template.itemClass} ${selectedId === item.id ? 'selected' : ''} ${templateId === 'clean' && item.revealState === 'searching' ? 'item-searching' : 'item-revealed'} ${item.isPreview ? 'item-preview' : ''} ${templateId === 'clean' && !deltaSearchEnabled ? 'item-no-search' : ''}`}><div className="item-frame" style={{ transform: `rotate(${item.rotation}deg)`, ...(item.animationDuration ? ({ ['--search-block-duration' as any]: `${item.animationDuration}s` } as React.CSSProperties) : {}) }}><img src={item.src} alt={item.name} draggable={false} />{templateId === 'clean' && <div className="item-search-overlay" aria-hidden="true"><div className="item-search-stripes" /><div className="item-search-magnifier"><div className="item-search-glass" /><div className="item-search-handle" /></div></div>}</div></Rnd>)}{flyingBack && <div className="flying-back" style={{ left: flyingBack.x, top: flyingBack.y, width: flyingBack.w, height: flyingBack.h }}><img src={flyingBack.src} alt="moving" /></div>}{flyingToLayer && <div className="flying-back flying-to-layer" style={{ left: flyingToLayer.x, top: flyingToLayer.y, width: flyingToLayer.w, height: flyingToLayer.h }}><img src={flyingToLayer.src} alt="moving to layer" /></div>}</div><div ref={libraryRef} className="library-panel">{available.length === 0 ? <div className="empty"></div> : <div className="asset-list asset-grid">{available.map((item) => <button key={item.sourceId} className="asset-card asset-card-image" draggable onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, sourceId: item.sourceId }) }} onClick={() => { previewLibraryItem(item.sourceId); setTemplateState((prev) => ({ ...prev, [templateId]: { ...prev[templateId], library: prev[templateId].library.filter((i) => i.sourceId !== item.sourceId) } })) }} onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.sourceId) }}><img src={item.src} alt={item.name} /></button>)}</div>}</div></div></main></div>

}

ReactDOM.createRoot(document.getElementById('app')!).render(<React.StrictMode><App /></React.StrictMode>)
