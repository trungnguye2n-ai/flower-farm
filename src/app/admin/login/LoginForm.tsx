'use client'
import { useActionState } from 'react'
import { Field } from '@/components/admin/Field'
import { loginAction, type LoginState } from './actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {})
  return (
    <form action={action} className="login-card glass" noValidate>
      <div className="login-brand">
        <b>Vườn hoa</b>
        <span>Quản lý sản phẩm, giá và đơn hàng</span>
      </div>
      <Field label="Email" name="email" type="email" autoComplete="username" inputMode="email" defaultValue={state.email} key={state.email} required autoFocus />
      <Field label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      <button className="btn" disabled={pending} aria-busy={pending}>
        {pending ? (
          <>
            <span className="spinner" aria-hidden /> Đang vào
          </>
        ) : (
          'Đăng nhập'
        )}
      </button>
      <p className="form-error" role="alert" aria-live="polite">
        {state.error ?? ''}
      </p>
    </form>
  )
}
