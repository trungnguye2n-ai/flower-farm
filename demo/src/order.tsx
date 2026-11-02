import { Stage } from './kit/stage'
import { Phone } from './kit/phone'
import { Thread, Bubble, Stamp, Receipt } from './kit/messages'
import type { Act } from './kit/act'
import { Composer, Shop, Time } from './zalo'

// Vườn Lan: what happens after "Đặt hoa". The site copies the order and opens
// Zalo; this shows the rest, in a Zalo-style chat on an iPhone.
//   1. Context: the garden's greeting, the composer empty.
//   2. Paste: a tap on the field, the iOS "Dán" callout, the order fills in.
//   3. Send: the order forms out of the field; Đã nhận, then Đã xem.
//   4. The garden types, and the dots grow into the confirmation.
// The confirmed conversation holds. The phone runs off the top: the composer
// and the newest messages are the story; the header is filler.
//
// Real strings: the stamp, the greeting, the field, the order, the receipt,
// the reply.

type S = { menu: boolean; draft: boolean; sent: boolean; seen: boolean; receipt: boolean; typing: boolean; reply: boolean }

const initial: S = { menu: false, draft: false, sent: false, seen: false, receipt: false, typing: false, reply: false }
const poster: S = { ...initial, sent: true, seen: true, receipt: false, reply: true }

const PASTED = 'Xin chào Vườn Lan, tôi muốn đặt: Bạch Moth'
const REST = { x: 320, y: 400 }

async function script(a: Act<S>) {
  await a.wait(1000)
  a.mark('paste')
  await a.click({ at: 'field', x: 0.35, y: 0.5 })
  await a.set({ menu: true })
  await a.wait(500)
  await a.click('paste')
  await a.set({ menu: false, draft: true })
  await a.wait(700)
  a.mark('send')
  await a.click({ at: 'send', x: 0.5, y: 0.5 })
  await a.set({ sent: true, draft: false, receipt: true })
  await a.wait(900)
  await a.set({ seen: true })
  await a.wait(900)
  a.mark('typing')
  await a.set({ typing: true })
  await a.wait(1700)
  // Their reply answers the order, so the receipt folds away
  await a.set({ typing: false, reply: true, receipt: false })
  await a.wait(3200)
  a.mark('done')
}

export default function VuonLanOrder() {
  return (
    <Stage<S> width={400} height={440} compact={{ below: 400, width: 358, height: 430 }} initial={initial} poster={poster} script={script} play="once" cursor={{ at: REST, style: 'touch' }} className="vl vl-order">
      {(s, _rect, layout) => (
        <Phone width={layout === 'compact' ? 326 : 340} className="vl-phone">
          <Thread className="vl-thread">
            <Stamp className="vl-date">20:31 Hôm qua</Stamp>
            <Bubble from="me">
              Vườn còn hồ điệp trắng không ạ?
              <Time>20:31</Time>
            </Bubble>
            <Bubble from="them" avatar={<Shop />}>
              Còn ạ. Bạch Moth đang nở đẹp, chậu 350.000đ.
              <Time>20:40</Time>
            </Bubble>
            <Stamp className="vl-date">08:12 Hôm nay</Stamp>
            <Bubble from="them" avatar={<Shop />}>
              Bạn đặt trên web, vườn nhận ngay ạ.
              <Time>08:12</Time>
            </Bubble>
            {s.sent && (
              <Bubble from="me" source="draft">
                Xin chào Vườn Lan, tôi muốn đặt: Bạch Moth (350.000đ). Lời nhắn: Chúc mừng khai trương.
                <Time>08:14</Time>
              </Bubble>
            )}
            <Receipt show={s.receipt}>{s.seen ? 'Đã xem' : 'Đã nhận'}</Receipt>
            {(s.typing || s.reply) && (
              <Bubble from="them" typing={s.typing} avatar={<Shop />}>
                Vườn nhận đơn rồi ạ. 9 giờ sáng mai giao tới, có ảnh cây gửi bạn trước khi đi.
                <Time>08:15</Time>
              </Bubble>
            )}
          </Thread>

          <Composer draft={s.draft ? PASTED : ''} menu={s.menu} />
        </Phone>
      )}
    </Stage>
  )
}
