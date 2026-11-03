'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes } from 'react'
import type { Result } from '@/admin/result'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const spring = { type: 'spring', bounce: 0, duration: 0.35 } as const

/** "Lưu" → spinner → "✓ Đã lưu" on the button itself; width follows the label, the text never stretches. */
export function SaveButton({
  state,
  label = 'Lưu',
  savedLabel = 'Đã lưu',
  errorLabel = 'Chưa lưu được',
  className = '',
  ...rest
}: { state: SaveState; label?: string; savedLabel?: string; errorLabel?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const content =
    state === 'saving' ? (
      <>
        <span className="spinner" aria-hidden /> Đang lưu
      </>
    ) : state === 'saved' ? (
      <>✓ {savedLabel}</>
    ) : state === 'error' ? (
      errorLabel
    ) : (
      label
    )
  return (
    <motion.button
      layout
      transition={spring}
      className={`btn save ${className}`}
      data-state={state}
      aria-busy={state === 'saving'}
      disabled={state === 'saving' || rest.disabled}
      {...(rest as object)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          layout="position"
          className="save-label"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={spring}
        >
          {content}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">
        {state === 'saved' ? savedLabel : state === 'error' ? errorLabel : ''}
      </span>
    </motion.button>
  )
}

/**
 * Runs a save and drives the button: saving → saved (1.6 s) → idle, or
 * error → idle. Returns the Result so the caller can show field errors.
 */
export function useSave<T>() {
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const run = useCallback(async (action: () => Promise<Result<T>>): Promise<Result<T>> => {
    clearTimeout(timer.current)
    setState('saving')
    let result: Result<T>
    try {
      result = await action()
    } catch {
      result = { ok: false, error: 'Mất kết nối, thử lại' }
    }
    setState(result.ok ? 'saved' : 'error')
    timer.current = setTimeout(() => setState('idle'), result.ok ? 1600 : 2200)
    return result
  }, [])
  return { state, run }
}
