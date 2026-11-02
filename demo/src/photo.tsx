import { Stage } from './kit/stage'
import { Phone } from './kit/phone'
import { Thread, Bubble, Stamp } from './kit/messages'
import type { Act } from './kit/act'
import { Composer, Shop, Time } from './zalo'
import './photo.css'

// Vườn Lan: the customer sees their own plant before it leaves the garden.
//   1. Context: the customer asked to see the plant; the garden is typing.
//   2. The photo arrives, then its caption.
//   3. The customer double-taps the photo: a heart.
//   4. They type "giao giúp mình nhé" and send; the garden answers with the time.
// Real strings: the stamp, the ask, the caption, the typed reply, the answer.

type S = { typing: boolean; photo: boolean; caption: boolean; heart: boolean; draft: string; sent: boolean; reply: boolean }

const initial: S = { typing: false, photo: false, caption: false, heart: false, draft: '', sent: false, reply: false }
const poster: S = { ...initial, photo: true, caption: true, heart: true, sent: true, reply: true }

const MINE = 'Đẹp quá, giao giúp mình nhé!'

async function script(a: Act<S>) {
  await a.wait(700)
  await a.set({ typing: true })
  await a.wait(1300)
  a.mark('photo')
  await a.set({ typing: false, photo: true })
  await a.wait(700)
  await a.set({ caption: true })
  await a.wait(1100)
  a.mark('heart')
  await a.click({ at: 'photo', x: 0.55, y: 0.45 }, { double: true })
  await a.set({ heart: true })
  await a.wait(900)
  a.mark('type')
  await a.click({ at: 'field', x: 0.3, y: 0.5 })
  await a.type('draft', MINE, { interval: 55 })
  await a.wait(300)
  await a.click({ at: 'send', x: 0.5, y: 0.5 })
  await a.set({ sent: true, draft: '' })
  await a.wait(1400)
  await a.set({ reply: true })
  await a.wait(3000)
  a.mark('done')
}

/* The garden's orchid, drawn as the page draws it (Bạch Moth's colors) */
const C = { petal: '#FFFFFF', vein: '#D5DAE3', edge: '#F4F6FA', lip: '#E3A43A', lipDeep: '#A85A1A' }
const SEPAL = 'M0 -6 C -18 -28, -24 -66, 0 -90 C 24 -66, 18 -28, 0 -6 Z'

function Bloom({ x, y, size, turn = 0 }: { x: number; y: number; size: number; turn?: number }) {
  const s = size / 200
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${s})`}>
      <g fill="url(#pp)" stroke={C.vein} strokeWidth="0.6" strokeOpacity="0.6">
        <path d={SEPAL} transform="rotate(128) scale(0.9)" />
        <path d={SEPAL} transform="rotate(-128) scale(0.9)" />
        <path d={SEPAL} />
        <path d="M-2 -2 C -14 -38, -54 -72, -86 -50 C -106 -24, -88 20, -2 6 Z" />
        <path d="M2 -2 C 14 -38, 54 -72, 86 -50 C 106 -24, 88 20, 2 6 Z" />
      </g>
      <g fill="url(#pl)">
        <path d="M-4 4 C -18 -2, -28 8, -24 20 C -20 26, -10 20, -4 12 Z" />
        <path d="M4 4 C 18 -2, 28 8, 24 20 C 20 26, 10 20, 4 12 Z" />
        <path d="M0 10 C -13 14, -16 34, -10 46 C -5 53, 5 53, 10 46 C 16 34, 13 14, 0 10 Z" />
      </g>
      <ellipse cx="0" cy="18" rx="6" ry="5" fill="#F2C94C" />
      <path d="M0 -14 C -7 -12, -7 4, 0 8 C 7 4, 7 -12, 0 -14 Z" fill={C.edge} stroke={C.vein} strokeWidth="0.6" />
    </g>
  )
}

function OrchidPhoto() {
  return (
    <svg className="vp-photo__img" viewBox="0 0 220 250" width={220} height={250} role="img" aria-label="Ảnh chậu lan Bạch Moth">
      <defs>
        <radialGradient id="pp" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="96">
          <stop offset="0" stopColor={C.vein} />
          <stop offset="0.3" stopColor={C.petal} />
          <stop offset="1" stopColor={C.edge} />
        </radialGradient>
        <linearGradient id="pl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.lipDeep} />
          <stop offset="1" stopColor={C.lip} />
        </linearGradient>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f8a78" />
          <stop offset="1" stopColor="#3f5a4a" />
        </linearGradient>
        <linearGradient id="pot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9e4dc" />
          <stop offset="0.6" stopColor="#fbf9f5" />
          <stop offset="1" stopColor="#d6cfc4" />
        </linearGradient>
      </defs>
      {/* Greenhouse shade behind, a bench edge below */}
      <rect width="220" height="250" fill="url(#wall)" />
      <rect y="214" width="220" height="36" fill="#2f4337" />
      {/* Leaves, the pot, the arching spike */}
      <path d="M110 196 C 70 188, 40 196, 22 214 C 56 206, 86 206, 110 204 Z" fill="#2e5a34" />
      <path d="M112 196 C 150 186, 182 192, 204 206 C 170 202, 140 204, 112 206 Z" fill="#3a6d3f" />
      <path d="M78 202 h64 l-8 44 h-48 Z" fill="url(#pot)" />
      <path d="M110 200 C 108 150, 112 100, 132 70 C 146 50, 166 44, 182 50" fill="none" stroke="#4b6b3a" strokeWidth="3" strokeLinecap="round" />
      <Bloom x={96} y={128} size={92} turn={-6} />
      <Bloom x={140} y={78} size={78} turn={4} />
      <Bloom x={176} y={46} size={50} turn={12} />
      <ellipse cx="190" cy="52" rx="6" ry="5" fill="#eef1ea" />
    </svg>
  )
}

export default function VuonLanPhoto() {
  return (
    <Stage<S> width={400} height={440} compact={{ below: 400, width: 358, height: 430 }} initial={initial} poster={poster} script={script} play="once" cursor={{ at: { x: 330, y: 400 }, style: 'touch' }} className="vl vl-photo">
      {(s, _rect, layout) => (
        <Phone width={layout === 'compact' ? 326 : 340} className="vl-phone">
          <Thread className="vl-thread">
            <Stamp className="vl-date">21:02 Hôm qua</Stamp>
            <Bubble from="me">
              Mình lấy chậu Bạch Moth nhé.
              <Time>21:02</Time>
            </Bubble>
            <Bubble from="them" avatar={<Shop />}>
              Dạ, sáng mai vườn giao ạ.
              <Time>21:05</Time>
            </Bubble>
            <Stamp className="vl-date">07:40 Hôm nay</Stamp>
            <Bubble from="me">
              Cho mình xem cây trước khi giao nhé.
              <Time>07:40</Time>
            </Bubble>
            {(s.typing || s.photo) && (
              <Bubble from="them" typing={s.typing} avatar={<Shop />} className="vp-photo" data-target="photo" tapback={{ emoji: '❤️', show: s.heart }}>
                <OrchidPhoto />
              </Bubble>
            )}
            {s.caption && (
              <Bubble from="them" avatar={<Shop />}>
                Cây của bạn đây ạ, 14 bông.
                <Time>07:52</Time>
              </Bubble>
            )}
            {s.sent && (
              <Bubble from="me" source="draft">
                {MINE}
                <Time>07:53</Time>
              </Bubble>
            )}
            {s.reply && (
              <Bubble from="them" avatar={<Shop />}>
                Dạ, 8 giờ xe đi ạ.
                <Time>07:54</Time>
              </Bubble>
            )}
          </Thread>
          <Composer draft={s.draft} caret />
        </Phone>
      )}
    </Stage>
  )
}
