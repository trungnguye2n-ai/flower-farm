'use client'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { project, useMediaQuery } from './hooks'

/**
 * Editing surface: a bottom sheet on phones (drag the top down or flick to
 * close; it follows the finger 1:1 and keeps the flick's speed), a panel from
 * the right on wide screens. Esc closes; focus moves in and comes back.
 */
export function Sheet({
  open,
  onClose,
  title,
  tint,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  tint?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const wide = useMediaQuery('(min-width: 900px)')
  const reduce = useReducedMotion()
  const controls = useDragControls()
  const ref = useRef<HTMLElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  const off = wide ? { x: '100%', y: 0 } : { x: 0, y: '100%' }
  const transition = reduce ? { duration: 0 } : { type: 'spring' as const, bounce: 0, duration: 0.42 }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.25 }}
            onClick={onClose}
          />
          <motion.section
            key="sheet"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`sheet ${wide ? 'side' : 'bottom'}`}
            style={{ '--tint': tint ?? 'transparent' } as CSSProperties}
            initial={off}
            animate={{ x: 0, y: 0 }}
            exit={off}
            transition={transition}
            drag={wide ? false : 'y'}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 1 }}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            onDragEnd={(_, info) => {
              const height = ref.current?.offsetHeight ?? 600
              if (info.offset.y + project(info.velocity.y) > height * 0.35) onClose()
            }}
          >
            <header className="sheet-head" onPointerDown={(e) => !wide && controls.start(e)}>
              {!wide && <span className="sheet-grabber" aria-hidden />}
              <h2 id={titleId}>{title}</h2>
              <button type="button" className="sheet-close press" onClick={onClose} aria-label="Đóng">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            <div className="sheet-body">{children}</div>
            {footer && <footer className="sheet-foot">{footer}</footer>}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
