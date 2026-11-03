import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type Common = { label: string; error?: string; hint?: string }
type InputProps = Common & { multiline?: false } & InputHTMLAttributes<HTMLInputElement>
type AreaProps = Common & { multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>

/** A labelled input whose error appears right under it (and is announced). */
export function Field(props: InputProps | AreaProps) {
  const id = useId()
  const { label, error, hint, multiline, className, ...rest } = props
  const described = [hint && `${id}-hint`, `${id}-error`].filter(Boolean).join(' ')
  const common = { id, className: `input ${className ?? ''}`, 'aria-invalid': error ? true : undefined, 'aria-describedby': described }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

/** Error text that opens in place (no layout jump for its neighbours beyond its own height). */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  return (
    <div id={id} className={`field-error ${message ? 'on' : ''}`} role="alert" aria-live="polite">
      <span>{message ?? ''}</span>
    </div>
  )
}
