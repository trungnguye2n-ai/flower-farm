'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { deleteCategoryAction, saveCategoryAction } from '@/app/admin/(app)/actions'
import type { FieldErrors } from '@/admin/result'
import { Field, FieldError } from './Field'
import { SaveButton, useSave } from './SaveButton'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Toggle } from './Toggle'
import type { UiCategory } from './types'

type CareRow = { key: string; title: string; body: string }
let rowKey = 0
const nextKey = () => `c${++rowKey}`

/** Edit or create a flower category, including its care guide shown on the landing page. */
export function CategorySheet({ open, category, onClose }: { open: boolean; category?: UiCategory; onClose: () => void }) {
  const toast = useToast()
  const save = useSave<{ id: string; slug: string }>()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()
  const [form, setForm] = useState(() => ({
    name: category?.name ?? '',
    description: category?.description ?? '',
    isVisible: category?.isVisible ?? true,
    care: (category?.care ?? []).map((c) => ({ key: nextKey(), ...c })) as CareRow[],
  }))

  const clear = (key: string) => errors[key] && setErrors(({ [key]: _, ...rest }) => rest)
  const setCare = (i: number, patch: Partial<CareRow>, field: 'title' | 'body') => {
    setForm((f) => ({ ...f, care: f.care.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
    clear(`care.${i}.${field}`)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await save.run(() =>
      saveCategoryAction({ id: category?.id, ...form, care: form.care.map(({ title, body }) => ({ title, body })) }),
    )
    setErrors(r.ok ? {} : (r.fieldErrors ?? {}))
    if (!r.ok && r.error) toast(r.error, { tone: 'error' })
    if (r.ok && !category) {
      onClose()
      toast(`Đã thêm ${form.name.trim()}`)
    }
  }

  async function remove() {
    if (!category) return
    const r = await deleteCategoryAction(category.id).catch(() => ({ ok: false as const, error: 'Mất kết nối, thử lại' }))
    if (!r.ok) {
      setConfirming(false)
      return setDeleteError(r.error)
    }
    onClose()
    toast(`Đã xoá ${category.name}`)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? category.name : 'Loại hoa mới'}
      footer={
        <>
          <SaveButton state={save.state} form="category-form" type="submit" label={category ? 'Lưu' : 'Thêm loại hoa'} />
          {category && (
            <div className="confirm">
              {confirming ? (
                <div className="confirm-ask">
                  <span>Xoá loại hoa?</span>
                  <button type="button" className="btn danger small" onClick={remove}>
                    Xoá
                  </button>
                  <button type="button" className="btn quiet small" onClick={() => setConfirming(false)}>
                    Huỷ
                  </button>
                </div>
              ) : (
                <button type="button" className="btn quiet small" onClick={() => (setDeleteError(undefined), setConfirming(true))}>
                  Xoá
                </button>
              )}
            </div>
          )}
        </>
      }
    >
      <form id="category-form" className="form" onSubmit={submit} noValidate>
        <FieldError message={deleteError ? `${deleteError}. Xoá hoặc chuyển hết sản phẩm sang loại khác trước.` : undefined} />
        <Field
          label="Tên loại hoa"
          value={form.name}
          onChange={(e) => (setForm((f) => ({ ...f, name: e.target.value })), clear('name'))}
          error={errors.name}
          placeholder="Ví dụ: Bách thủy tiên"
        />
        <Field
          label="Giới thiệu"
          multiline
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />

        <div className="field">
          <span className="field-label">Cách chăm sóc</span>
          <ul className="care">
            <AnimatePresence initial={false}>
              {form.care.map((c, i) => (
                <motion.li
                  key={c.key}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                >
                  <div className="care-item">
                    <input
                      className="input"
                      aria-label={`Tiêu đề mục ${i + 1}`}
                      placeholder="Ánh sáng"
                      value={c.title}
                      aria-invalid={errors[`care.${i}.title`] ? true : undefined}
                      onChange={(e) => setCare(i, { title: e.target.value }, 'title')}
                    />
                    <textarea
                      className="input"
                      rows={2}
                      aria-label={`Nội dung mục ${i + 1}`}
                      placeholder="Cần nhiều sáng, tốt nhất là nắng buổi sáng."
                      value={c.body}
                      aria-invalid={errors[`care.${i}.body`] ? true : undefined}
                      onChange={(e) => setCare(i, { body: e.target.value }, 'body')}
                    />
                    <div className="care-tools">
                      <button
                        type="button"
                        className="btn quiet small"
                        disabled={i === 0}
                        onClick={() =>
                          setForm((f) => {
                            const care = [...f.care]
                            ;[care[i - 1], care[i]] = [care[i], care[i - 1]]
                            return { ...f, care }
                          })
                        }
                      >
                        Lên trên
                      </button>
                      <button type="button" className="btn quiet small" onClick={() => setForm((f) => ({ ...f, care: f.care.filter((_, j) => j !== i) }))}>
                        Bỏ mục này
                      </button>
                    </div>
                  </div>
                  <FieldError message={errors[`care.${i}.title`] ?? errors[`care.${i}.body`]} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <button type="button" className="add-row press" onClick={() => setForm((f) => ({ ...f, care: [...f.care, { key: nextKey(), title: '', body: '' }] }))}>
            + Thêm mục chăm sóc
          </button>
        </div>

        <div className="switch-row">
          <span>
            <b>Hiện trên trang</b>
            <small>Tắt để ẩn cả loại hoa khỏi khách.</small>
          </span>
          <Toggle checked={form.isVisible} onChange={(v) => setForm((f) => ({ ...f, isVisible: v }))} label="Hiện trên trang" />
        </div>
      </form>
    </Sheet>
  )
}
