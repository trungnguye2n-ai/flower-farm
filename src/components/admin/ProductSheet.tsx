'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { deleteProductAction, restoreProductAction, saveProductAction } from '@/app/admin/(app)/actions'
import type { FieldErrors } from '@/admin/result'
import { Field, FieldError } from './Field'
import { SaveButton, useSave } from './SaveButton'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Toggle } from './Toggle'
import type { UiCategory, UiProduct } from './types'

type VariantRow = { key: string; id?: string; name: string; price: string; inStock: boolean }

const PALETTE = ['#9E1B32', '#B8323F', '#D9467C', '#E8902A', '#F2C14E', '#6B8F3A', '#1E3644', '#7A4E9E']
let rowKey = 0
const nextKey = () => `v${++rowKey}`

/** Edit or create a product. The sheet takes the product's own color as it changes. */
export function ProductSheet({
  open,
  product,
  categoryId,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean
  product?: UiProduct
  categoryId: string
  categories: UiCategory[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const toast = useToast()
  const save = useSave<{ id: string; slug: string }>()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    shortDescription: product?.shortDescription ?? '',
    accentColor: product?.accentColor ?? PALETTE[0],
    isVisible: product?.isVisible ?? true,
    categoryId: product?.categoryId ?? categoryId,
    variants: (product?.variants.length
      ? product.variants.map((v) => ({ key: nextKey(), id: v.id, name: v.name, price: new Intl.NumberFormat('vi-VN').format(v.price), inStock: v.inStock }))
      : [{ key: nextKey(), name: '', price: '', inStock: true }]) as VariantRow[],
  }))

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K], errorKey: string = key) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[errorKey]) setErrors(({ [errorKey]: _, ...rest }) => rest)
  }
  const setVariant = (i: number, patch: Partial<VariantRow>, field?: 'name' | 'price') => {
    setForm((f) => ({ ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }))
    const key = `variants.${i}.${field}`
    if (field && errors[key]) setErrors(({ [key]: _, ...rest }) => rest)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await save.run(() =>
      saveProductAction({
        id: product?.id,
        ...form,
        variants: form.variants.map(({ id, name, price, inStock }) => ({ id, name, price, inStock })),
      }),
    )
    setErrors(r.ok ? {} : (r.fieldErrors ?? {}))
    if (!r.ok && r.error) toast(r.error, { tone: 'error' })
    if (r.ok && !product) onCreated(r.data.id)
  }

  async function remove() {
    if (!product) return
    const r = await deleteProductAction(product.id).catch(() => ({ ok: false as const }))
    if (!r.ok) return toast('Chưa xoá được, thử lại', { tone: 'error' })
    onClose()
    toast(`Đã xoá ${product.name}`, {
      ms: 10_000,
      action: {
        label: 'Hoàn tác',
        run: () => void restoreProductAction(product.id).then((x) => !x.ok && toast('Chưa khôi phục được', { tone: 'error' })),
      },
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={product ? product.name || 'Sản phẩm' : 'Sản phẩm mới'}
      tint={form.accentColor}
      footer={
        <>
          <SaveButton state={save.state} form="product-form" type="submit" label={product ? 'Lưu' : 'Tạo sản phẩm'} />
          {product && (
            <div className="confirm">
              <AnimatePresence initial={false} mode="popLayout">
                {confirming ? (
                  <motion.div key="ask" className="confirm-ask" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                    <span>Xoá sản phẩm?</span>
                    <button type="button" className="btn danger small" onClick={remove}>
                      Xoá
                    </button>
                    <button type="button" className="btn quiet small" onClick={() => setConfirming(false)}>
                      Huỷ
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="del"
                    type="button"
                    className="btn quiet small"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    onClick={() => setConfirming(true)}
                  >
                    Xoá
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      }
    >
      <form id="product-form" className="form" onSubmit={submit} noValidate>
        <Field label="Tên" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="Ví dụ: Đỏ nhung" />
        <Field
          label="Mô tả ngắn"
          multiline
          rows={2}
          value={form.shortDescription}
          onChange={(e) => set('shortDescription', e.target.value)}
          placeholder="Một câu cho khách hình dung bông hoa"
        />

        <div className="field">
          <span className="field-label">Kiểu bán và giá</span>
          <ul className="variants">
            <AnimatePresence initial={false}>
              {form.variants.map((v, i) => (
                <motion.li
                  key={v.key}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                >
                  <div className="variant">
                    <input
                      className="input"
                      aria-label={`Kiểu bán ${i + 1}`}
                      placeholder="Củ trần, chậu đang nở…"
                      value={v.name}
                      aria-invalid={errors[`variants.${i}.name`] ? true : undefined}
                      onChange={(e) => setVariant(i, { name: e.target.value }, 'name')}
                    />
                    <div className="price-input">
                      <input
                        className="input"
                        aria-label={`Giá kiểu ${i + 1}`}
                        inputMode="numeric"
                        placeholder="150.000"
                        value={v.price}
                        aria-invalid={errors[`variants.${i}.price`] ? true : undefined}
                        onChange={(e) => setVariant(i, { price: e.target.value }, 'price')}
                      />
                      <span aria-hidden>đ</span>
                    </div>
                    <Toggle checked={v.inStock} onChange={(on) => setVariant(i, { inStock: on })} label={`Kiểu ${i + 1} còn hàng`} />
                    <button
                      type="button"
                      className="icon-btn press"
                      aria-label={`Bỏ kiểu ${i + 1}`}
                      disabled={form.variants.length === 1}
                      title={form.variants.length === 1 ? 'Sản phẩm cần ít nhất một kiểu bán' : undefined}
                      onClick={() => set('variants', form.variants.filter((_, j) => j !== i))}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M6 12h12" />
                      </svg>
                    </button>
                  </div>
                  <FieldError message={errors[`variants.${i}.name`] ?? errors[`variants.${i}.price`]} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <FieldError message={errors.variants} />
          <button
            type="button"
            className="add-row press"
            onClick={() => set('variants', [...form.variants, { key: nextKey(), name: '', price: '', inStock: true }], 'variants')}
          >
            + Thêm kiểu bán
          </button>
          <span className="field-hint">Gõ giá kiểu nào cũng được: 150000, 150.000 hay 150k.</span>
        </div>

        <div className="field">
          <span className="field-label">Màu của sản phẩm</span>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className="swatch press"
                style={{ background: c }}
                aria-label={c}
                aria-pressed={form.accentColor.toUpperCase() === c}
                onClick={() => set('accentColor', c)}
              />
            ))}
            <label className="swatch custom press" style={{ background: form.accentColor }}>
              <input type="color" value={form.accentColor} onChange={(e) => set('accentColor', e.target.value.toUpperCase())} aria-label="Chọn màu khác" />
            </label>
            <input
              className="input hex"
              value={form.accentColor}
              onChange={(e) => set('accentColor', e.target.value)}
              aria-label="Mã màu"
              aria-invalid={errors.accentColor ? true : undefined}
              spellCheck={false}
            />
            <SuggestColor product={product} onPick={(c) => set('accentColor', c)} />
          </div>
          <FieldError message={errors.accentColor} />
          <span className="field-hint">Màu này nhuộm trang khi khách xem sản phẩm.</span>
        </div>

        {categories.length > 1 && (
          <div className="field">
            <label htmlFor="product-category">Loại hoa</label>
            <select id="product-category" className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.categoryId} />
          </div>
        )}

        <div className="switch-row">
          <span>
            <b>Hiện trên trang</b>
            <small>Tắt để ẩn hẳn khỏi khách, không xoá.</small>
          </span>
          <Toggle checked={form.isVisible} onChange={(v) => set('isVisible', v)} label="Hiện trên trang" />
        </div>
      </form>

    </Sheet>
  )
}

/** Picks the most colorful tone of the primary photo, from its tiny blur placeholder (same origin, no CORS). */
function SuggestColor({ product, onPick }: { product?: UiProduct; onPick: (hex: string) => void }) {
  const blur = (product?.images.find((i) => i.isPrimary) ?? product?.images[0])?.blurData
  if (!blur) return null
  return (
    <button type="button" className="btn quiet small" onClick={async () => onPick(await dominantColor(blur))}>
      Gợi ý từ ảnh
    </button>
  )
}

async function dominantColor(dataUrl: string): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let best = { score: -1, r: 0, g: 0, b: 0 }
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    // Saturated, mid-bright pixels: the petals rather than leaves in shadow or sky
    const score = (max - min) * (1 - Math.abs(max - 150) / 150)
    if (score > best.score) best = { score, r, g, b }
  }
  return `#${[best.r, best.g, best.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
