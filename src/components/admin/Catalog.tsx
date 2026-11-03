'use client'
import { Reorder, useDragControls } from 'motion/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { reorderAction, restoreProductAction, setInStockAction } from '@/app/admin/(app)/actions'
import { CategorySheet } from './CategorySheet'
import { ProductSheet } from './ProductSheet'
import { useToast } from './Toast'
import { Toggle } from './Toggle'
import { priceRange, type UiCategory, type UiProduct } from './types'

/**
 * The catalog: categories as sections, products as rows. Drag a row by its
 * grip to reorder; tap a row to edit it in a sheet. The open sheet lives in
 * the URL (?sua=<id>, ?sua=moi&loai=<category>, ?loai=<id|moi>) so a reload reopens it.
 */
export function Catalog({ categories, deleted }: { categories: UiCategory[]; deleted: UiProduct[] }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const toast = useToast()
  const [cats, setCats] = useState(categories)
  const [view, setView] = useState<'live' | 'deleted'>('live')
  useEffect(() => setCats(categories), [categories])
  // Drop handlers read the order after the drag settles, not the render's copy
  const latest = useRef(cats)
  latest.current = cats

  const go = useCallback((query: string) => router.replace(query ? `${path}?${query}` : path, { scroll: false }), [router, path])
  const close = useCallback(() => go(''), [go])

  const editing = params.get('sua')
  const categoryParam = params.get('loai')
  const allProducts = cats.flatMap((c) => c.products)
  const product = editing && editing !== 'moi' ? allProducts.find((p) => p.id === editing) : undefined
  const productOpen = editing === 'moi' ? Boolean(categoryParam) : Boolean(product)
  const category = !editing && categoryParam && categoryParam !== 'moi' ? cats.find((c) => c.id === categoryParam) : undefined
  const categoryOpen = !editing && (categoryParam === 'moi' || Boolean(category))

  async function toggleStock(p: UiProduct, inStock: boolean) {
    const flip = (value: boolean) =>
      setCats((cs) =>
        cs.map((c) => ({
          ...c,
          products: c.products.map((x) => (x.id === p.id ? { ...x, inStock: value, variants: x.variants.map((v) => ({ ...v, inStock: value })) } : x)),
        })),
      )
    flip(inStock)
    const r = await setInStockAction(p.id, inStock).catch(() => ({ ok: false as const }))
    if (!r.ok) {
      flip(!inStock)
      toast('Chưa đổi được trạng thái, thử lại', { tone: 'error' })
    }
  }

  async function saveOrder(kind: 'categories' | 'products', ids: string[]) {
    const r = await reorderAction(kind, ids).catch(() => ({ ok: false as const }))
    if (!r.ok) {
      setCats(categories)
      toast('Chưa lưu được thứ tự, thử lại', { tone: 'error' })
    }
  }

  async function restore(p: UiProduct) {
    const r = await restoreProductAction(p.id).catch(() => ({ ok: false as const }))
    toast(r.ok ? `Đã khôi phục ${p.name}` : 'Chưa khôi phục được, thử lại', { tone: r.ok ? undefined : 'error' })
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>Sản phẩm</h1>
        <div className="segmented" role="tablist" aria-label="Xem">
          <button role="tab" aria-selected={view === 'live'} className="press" onClick={() => setView('live')}>
            Đang bán
          </button>
          <button role="tab" aria-selected={view === 'deleted'} className="press" onClick={() => setView('deleted')}>
            Đã xoá{deleted.length ? ` · ${deleted.length}` : ''}
          </button>
        </div>
      </div>

      {view === 'deleted' ? (
        <section className="group">
          {deleted.length === 0 ? (
            <p className="empty">Chưa có sản phẩm nào bị xoá.</p>
          ) : (
            <ul className="rows">
              {deleted.map((p) => (
                <li key={p.id} className="row static">
                  <Thumb product={p} />
                  <div className="row-main">
                    <b>{p.name}</b>
                    <span>{priceRange(p)}</span>
                  </div>
                  <button className="btn quiet small" onClick={() => restore(p)}>
                    Khôi phục
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <Reorder.Group
          as="div"
          axis="y"
          values={cats}
          onReorder={setCats}
          className="groups"
        >
          {cats.map((c) => (
            <Sortable
              key={c.id}
              value={c}
              as="section"
              className="group"
              onDrop={() => saveOrder('categories', latest.current.map((x) => x.id))}
              render={(grip) => (
                <>
                  <header className="group-head">
                    {grip}
                    <h2>{c.name}</h2>
                    {!c.isVisible && <span className="tag">Đang ẩn</span>}
                    <span className="count">{c.products.length} sản phẩm</span>
                    <button className="btn quiet small" onClick={() => go(`loai=${c.id}`)}>
                      Sửa
                    </button>
                  </header>
                  <Reorder.Group
                    as="ul"
                    axis="y"
                    className="rows"
                    values={c.products}
                    onReorder={(products) => setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, products } : x)))}
                  >
                    {c.products.map((p) => (
                      <Sortable
                        key={p.id}
                        value={p}
                        as="li"
                        className="row"
                        onDrop={() => saveOrder('products', latest.current.find((x) => x.id === c.id)!.products.map((x) => x.id))}
                        render={(grip) => (
                          <>
                            <button className="row-open press" onClick={() => go(`sua=${p.id}`)} aria-label={`Sửa ${p.name}`}>
                              <Thumb product={p} />
                              <span className="row-main">
                                <b>{p.name}</b>
                                <span>
                                  {priceRange(p)}
                                  {p.variants.length > 1 && <i> · {p.variants.length} kiểu</i>}
                                </span>
                              </span>
                              {!p.isVisible && <span className="tag">Ẩn</span>}
                            </button>
                            <span className={`stock ${p.inStock ? '' : 'out'}`}>{p.inStock ? 'Còn hàng' : 'Tạm hết'}</span>
                            <Toggle checked={p.inStock} onChange={(v) => toggleStock(p, v)} label={`${p.name} còn hàng`} />
                            {grip}
                          </>
                        )}
                      />
                    ))}
                  </Reorder.Group>
                  <button className="add-row press" onClick={() => go(`sua=moi&loai=${c.id}`)}>
                    + Thêm sản phẩm
                  </button>
                </>
              )}
            />
          ))}
          <button className="add-group press" onClick={() => go('loai=moi')}>
            + Thêm loại hoa
          </button>
        </Reorder.Group>
      )}

      <ProductSheet
        key={editing ?? 'none'}
        open={productOpen}
        product={product}
        categoryId={product?.categoryId ?? categoryParam ?? ''}
        categories={cats}
        onClose={close}
        onCreated={(id) => go(`sua=${id}`)}
      />
      <CategorySheet key={`c-${categoryParam ?? 'none'}`} open={categoryOpen} category={category} onClose={close} />
    </main>
  )
}

/** A reorderable item dragged only by its grip, so taps and scrolling still work. */
function Sortable<T>({
  value,
  as,
  className,
  onDrop,
  render,
}: {
  value: T
  as: 'li' | 'section'
  className: string
  onDrop: () => void
  render: (grip: ReactNode) => ReactNode
}) {
  const controls = useDragControls()
  const grip = (
    <button
      type="button"
      className="grip"
      aria-label="Kéo để đổi thứ tự"
      onPointerDown={(e) => {
        e.preventDefault()
        controls.start(e)
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
        {[7, 12, 17].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
      </svg>
    </button>
  )
  return (
    <Reorder.Item
      as={as}
      value={value}
      className={className}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      whileDrag={{ scale: 1.02, boxShadow: '0 18px 40px -16px rgba(0,0,0,0.35)', zIndex: 5 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
    >
      {render(grip)}
    </Reorder.Item>
  )
}

/** Primary photo, or a soft bloom of the product's own color while it has none. */
export function Thumb({ product, size = 56 }: { product: UiProduct; size?: number }) {
  const img = product.images.find((i) => i.isPrimary) ?? product.images[0]
  const style = { '--accent': product.accentColor, width: size, height: size } as CSSProperties
  if (!img)
    return (
      <span className="thumb empty" style={style} aria-hidden>
        <span />
      </span>
    )
  return (
    <span className="thumb" style={{ ...style, backgroundImage: img.blurData ? `url(${img.blurData})` : undefined }}>
      <img src={img.src} srcSet={img.srcSet} sizes={`${size}px`} alt={img.alt || product.name} loading="lazy" decoding="async" />
    </span>
  )
}
