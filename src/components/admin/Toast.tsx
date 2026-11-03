'use client'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Toast = { id: number; message: string; tone?: 'error'; action?: { label: string; run: () => void }; ms: number }
type Show = (message: string, opts?: { tone?: 'error'; action?: Toast['action']; ms?: number }) => void

const Ctx = createContext<Show>(() => {})
export const useToast = () => useContext(Ctx)

/** One toast at a time, above the tab bar; a new one replaces the old. */
export function Toasts({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback<Show>((message, opts = {}) => {
    clearTimeout(timer.current)
    const t = { id: Date.now(), message, tone: opts.tone, action: opts.action, ms: opts.ms ?? 4000 }
    setToast(t)
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === t.id ? null : cur)), t.ms)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-dock" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={`toast glass ${toast.tone ?? ''}`}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            >
              <span>{toast.message}</span>
              {toast.action && (
                <button
                  className="toast-action press"
                  onClick={() => {
                    toast.action!.run()
                    setToast(null)
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
