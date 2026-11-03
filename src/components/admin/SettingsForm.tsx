'use client'
import { useState } from 'react'
import { saveSettingsAction } from '@/app/admin/(app)/cai-dat/actions'
import type { SettingsInput } from '@/admin/settings'
import type { FieldErrors } from '@/admin/result'
import { Field } from './Field'
import { SaveButton, useSave } from './SaveButton'
import { useToast } from './Toast'

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const toast = useToast()
  const save = useSave<null>()
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const field = (key: keyof SettingsInput) => ({
    value: form[key],
    error: errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest)
    },
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await save.run(() => saveSettingsAction(form))
    setErrors(r.ok ? {} : (r.fieldErrors ?? {}))
    if (!r.ok && r.error) toast(r.error, { tone: 'error' })
  }

  return (
    <form className="form card" onSubmit={submit} noValidate>
      <Field label="Tên vườn" {...field('shopName')} />
      <div className="two">
        <Field label="Số điện thoại" type="tel" inputMode="tel" autoComplete="off" {...field('phone')} />
        <Field label="Số Zalo" type="tel" inputMode="tel" autoComplete="off" hint="Để trống nếu trùng số điện thoại" {...field('zalo')} />
      </div>
      <Field label="Giờ nhận đơn" placeholder="7:00 đến 18:00, mỗi ngày" {...field('hours')} />
      <Field label="Khu vực giao" multiline rows={2} {...field('deliveryArea')} />
      <Field label="Địa chỉ vườn" multiline rows={2} {...field('address')} />
      <div>
        <SaveButton state={save.state} type="submit" />
      </div>
    </form>
  )
}
