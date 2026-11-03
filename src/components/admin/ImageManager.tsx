'use client'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { deleteImageAction, reorderImagesAction, setPrimaryImageAction } from '@/app/admin/(app)/actions'
import { preparePhoto } from './prepare-photo'
import { useToast } from './Toast'
import type { UiImage, UiProduct } from './types'

type Pending = { key: string; file: File; preview: string; progress: number; error?: string; doneId?: string }

const PARALLEL = 2

/**
 * Photos of one product. Chosen files show at once from the device, upload
 * two at a time with a progress ring, then settle into the stored photo.
 * Tap a photo to select it, then act on it from the bar below; drag its grip to reorder.
 */
export function ImageManager({ product }: { product?: UiProduct }) {
  if (!product) {
    return (
      <section className="photos">
        <h3>Ảnh</h3>
        <p className="field-hint">Bấm “Tạo sản phẩm” trước, rồi thêm ảnh ngay tại đây.</p>
      </section>
    )
  }
  return <Photos product={product} />
}

function Photos({ product }: { product: UiProduct }) {
  const router = useRouter()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [order, setOrder] = useState(product.images)
  const [pending, setPending] = useState<Pending[]>([])
  const [menu, setMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => setConfirmDelete(false), [menu])
  const selected = order.find((i) => i.id === menu)
  const latest = useRef(order)
  latest.current = order
  useEffect(() => setOrder(product.images), [product.images])

  // A finished upload's tile leaves once the stored photo has arrived from the server
  useEffect(() => {
    const ids = new Set(product.images.map((i) => i.id))
    setPending((ps) => {
      const done = ps.filter((p) => p.doneId && ids.has(p.doneId))
      done.forEach((p) => p.preview && URL.revokeObjectURL(p.preview))
      return done.length ? ps.filter((p) => !done.includes(p)) : ps
    })
  }, [product.images])

  // Start queued uploads, PARALLEL at a time
  const running = useRef(new Set<string>())
  useEffect(() => {
    const waiting = pending.filter((p) => p.progress === 0 && !p.error && !running.current.has(p.key))
    for (const p of waiting.slice(0, Math.max(0, PARALLEL - running.current.size))) {
      running.current.add(p.key)
      upload(p).finally(() => running.current.delete(p.key))
    }
  })

  const update = (key: string, patch: Partial<Pending>) => setPending((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  async function upload(p: Pending) {
    let file: File
    try {
      file = await preparePhoto(p.file)
    } catch {
      return update(p.key, { error: 'Không đọc được ảnh này' })
    }
    // HEIC cannot be previewed outside Safari: show the converted copy instead
    if (!p.preview) update(p.key, { preview: URL.createObjectURL(file) })
    update(p.key, { progress: 0.02 })
    const body = new FormData()
    body.set('productId', product.id)
    body.set('alt', product.name)
    body.set('file', file)
    const result = await new Promise<{ ok: boolean; id?: string; error?: string }>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/admin/images')
      xhr.upload.onprogress = (e) => e.lengthComputable && update(p.key, { progress: Math.max(0.02, (e.loaded / e.total) * 0.92) })
      xhr.onload = () => {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({ ok: false, error: 'Không tải được ảnh, thử lại' })
        }
      }
      xhr.onerror = () => resolve({ ok: false, error: 'Mất kết nối, thử lại' })
      xhr.send(body)
    })
    if (!result.ok) return update(p.key, { error: result.error ?? 'Không tải được ảnh', progress: 0 })
    update(p.key, { progress: 1, doneId: result.id })
    router.refresh()
  }

  function choose(files: FileList | null) {
    if (!files?.length) return
    const heic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)
    const added = [...files].map((file, i) => ({ key: `${Date.now()}-${i}`, file, preview: heic(file) ? '' : URL.createObjectURL(file), progress: 0 }))
    setPending((ps) => [...ps, ...added])
  }

  async function act(run: () => Promise<{ ok: boolean; error?: string }>, failure: string) {
    setMenu(null)
    const r = await run().catch(() => ({ ok: false, error: undefined }))
    if (!r.ok) toast(r.error ?? failure, { tone: 'error' })
  }

  async function saveOrder() {
    const ids = latest.current.map((i) => i.id)
    const r = await reorderImagesAction(product.id, ids).catch(() => ({ ok: false as const }))
    if (!r.ok) {
      setOrder(product.images)
      toast('Chưa lưu được thứ tự ảnh', { tone: 'error' })
    }
  }

  return (
    <section className="photos">
      <div className="photos-head">
        <h3>Ảnh</h3>
        <button type="button" className="btn quiet small" onClick={() => input.current?.click()}>
          Chụp / chọn ảnh
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            choose(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {order.length === 0 && pending.length === 0 ? (
        <button type="button" className="photo-drop press" onClick={() => input.current?.click()}>
          <b>Thêm ảnh đầu tiên</b>
          <span>Ảnh đầu tiên sẽ là ảnh chính, hiện trên trang</span>
        </button>
      ) : (
        <div className="photo-strip">
          <Reorder.Group as="ul" axis="x" values={order} onReorder={setOrder} className="photo-list">
            {order.map((img) => (
              <PhotoTile
                key={img.id}
                img={img}
                open={menu === img.id}
                onToggle={() => setMenu(menu === img.id ? null : img.id)}
                onDrop={saveOrder}
              />
            ))}
          </Reorder.Group>
          <AnimatePresence initial={false}>
            {pending.map((p) => (
              <motion.div
                key={p.key}
                className={`photo uploading ${p.error ? 'failed' : ''}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              >
                {p.preview && <img src={p.preview} alt="" />}
                {p.error ? (
                  <div className="photo-error">
                    <span>{p.error}</span>
                    <button type="button" className="btn small" onClick={() => update(p.key, { error: undefined, progress: 0 })}>
                      Thử lại
                    </button>
                    <button
                      type="button"
                      className="photo-dismiss"
                      aria-label="Bỏ ảnh này"
                      onClick={() => {
                        p.preview && URL.revokeObjectURL(p.preview)
                        setPending((ps) => ps.filter((x) => x.key !== p.key))
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <Ring value={p.progress} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            key={selected.id}
            className="photo-actions"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            <div>
              {confirmDelete ? (
                <>
                  <span>Xoá ảnh này?</span>
                  <button type="button" className="btn danger small" onClick={() => act(() => deleteImageAction(selected.id), 'Chưa xoá được ảnh')}>
                    Xoá
                  </button>
                  <button type="button" className="btn quiet small" onClick={() => setConfirmDelete(false)}>
                    Huỷ
                  </button>
                </>
              ) : (
                <>
                  {!selected.isPrimary && (
                    <button type="button" className="btn small" onClick={() => act(() => setPrimaryImageAction(selected.id), 'Chưa đặt được ảnh chính')}>
                      Đặt làm ảnh chính
                    </button>
                  )}
                  <button type="button" className="btn quiet small" onClick={() => setConfirmDelete(true)}>
                    Xoá ảnh
                  </button>
                  <button type="button" className="btn quiet small" onClick={() => setMenu(null)}>
                    Xong
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="field-hint">JPEG, PNG, WebP hoặc ảnh iPhone (HEIC), tối đa 15 MB. Chạm vào ảnh để đặt làm ảnh chính hoặc xoá.</p>
    </section>
  )
}

function PhotoTile({
  img,
  open,
  onToggle,
  onDrop,
}: {
  img: UiImage
  open: boolean
  onToggle: () => void
  onDrop: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      as="li"
      value={img}
      className={`photo ${open ? 'selected' : ''}`}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      whileDrag={{ scale: 1.06, zIndex: 5, boxShadow: '0 14px 30px -10px rgba(0,0,0,0.4)' }}
      style={{ backgroundImage: img.blurData ? `url(${img.blurData})` : undefined }}
    >
      <button type="button" className="photo-open" onClick={onToggle} aria-expanded={open} aria-label={img.isPrimary ? 'Ảnh chính' : 'Ảnh'}>
        <img src={img.src} srcSet={img.srcSet} sizes="112px" alt={img.alt} draggable={false} />
      </button>
      {img.isPrimary && <span className="photo-badge">Ảnh chính</span>}
      <span
        className="photo-grip"
        aria-hidden
        onPointerDown={(e) => {
          e.preventDefault()
          controls.start(e)
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          {[8, 16].flatMap((x) => [8, 16].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" />))}
        </svg>
      </span>
    </Reorder.Item>
  )
}

function Ring({ value }: { value: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 40 40" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        transform="rotate(-90 20 20)"
        style={{ transition: 'stroke-dashoffset 200ms linear' }}
      />
    </svg>
  )
}
