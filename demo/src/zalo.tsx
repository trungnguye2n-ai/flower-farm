// Shared pieces of the Zalo-style chat used by every Vườn Lan demo:
// the garden's avatar, the time line, the composer and its glyphs.
import type { ReactNode } from 'react'
import { Avatar } from './kit/parts/Avatar'
import { Popover } from './kit/motion/Popover'
import './zalo.css'

export const Shop = () => <Avatar name="Vườn Lan" size={28} className="vl-avatar" style={{ background: 'var(--vl-shop)' }} />

export const Time = ({ children }: { children: ReactNode }) => <span className="vl-time">{children}</span>

function Sticker() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="10" r="1.2" fill="currentColor" />
      <path d="M8.4 14.2a4.4 4.4 0 0 0 7.2 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ImageGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="m4.4 17.4 4.8-4.4 3.4 3 2.6-2.2 4.4 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function Send() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path d="M4.2 11.2 19.4 4.6c.6-.3 1.2.3.9.9l-6.6 15.2c-.3.7-1.3.6-1.5-.1l-1.7-5.6a1 1 0 0 0-.6-.6L4.3 12.7c-.7-.2-.8-1.2-.1-1.5Z" fill="currentColor" />
    </svg>
  )
}

/**
 * The composer: sticker, field, then image or send in one place.
 * `draft` is the field's text ('' shows the placeholder); `caret` shows a
 * typing caret; `menu` opens the iOS "Dán" callout above the field.
 */
export function Composer({ draft, caret = false, menu = false }: { draft: string; caret?: boolean; menu?: boolean }) {
  const on = draft ? '' : undefined
  return (
    <div className="vl-compose" data-menu={menu ? '' : undefined}>
      <Popover show={menu} origin="bottom left" className="vl-menu">
        <span data-target="paste">Dán</span>
      </Popover>
      <span className="vl-icon">
        <Sticker />
      </span>
      <span className="vl-field" data-target="field">
        <span className="vl-field__text" data-target="draft" data-show={on}>
          {draft}
          {caret && draft && <i className="vl-caret" data-snap />}
        </span>
        <span className="vl-field__ph" data-hide={on}>
          Tin nhắn
        </span>
      </span>
      <span className="vl-action">
        <span className="vl-icon vl-image" data-off={on}>
          <ImageGlyph />
        </span>
        <span className="vl-send" data-on={on} data-target="send">
          <Send />
        </span>
      </span>
    </div>
  )
}
