import { Stage } from './kit/stage'
import { Phone } from './kit/phone'
import { Thread, Bubble, Stamp, Receipt } from './kit/messages'
import type { Act } from './kit/act'
import { Composer, Shop, Time } from './zalo'

// Vườn Lan after the sale: a customer worried about a yellow leaf asks, and
// the garden answers in two short messages.
//   1. Context: the garden's check-in from the week before.
//   2. The question is typed and sent; Đã nhận, then Đã xem.
//   3. The garden types; the dots grow into the answer, a second line follows.
// Real strings: the stamps, the check-in, the question, the two answers.

type S = { draft: string; sent: boolean; receipt: boolean; seen: boolean; typing: boolean; reply: boolean; more: boolean }

const initial: S = { draft: '', sent: false, receipt: false, seen: false, typing: false, reply: false, more: false }
const poster: S = { ...initial, sent: true, seen: true, reply: true, more: true }

const MINE = 'Lá dưới cùng bị vàng, có sao không vườn?'

async function script(a: Act<S>) {
  await a.wait(800)
  a.mark('type')
  await a.click({ at: 'field', x: 0.3, y: 0.5 })
  await a.type('draft', MINE, { interval: 50 })
  await a.wait(300)
  await a.click({ at: 'send', x: 0.5, y: 0.5 })
  await a.set({ sent: true, draft: '', receipt: true })
  await a.wait(900)
  await a.set({ seen: true })
  await a.wait(800)
  a.mark('answer')
  await a.set({ typing: true })
  await a.wait(1600)
  await a.set({ typing: false, reply: true, receipt: false })
  await a.wait(1500)
  await a.set({ more: true })
  await a.wait(3200)
  a.mark('done')
}

export default function VuonLanCare() {
  return (
    <Stage<S> width={400} height={440} compact={{ below: 400, width: 358, height: 430 }} initial={initial} poster={poster} script={script} play="once" cursor={{ at: { x: 330, y: 400 }, style: 'touch' }} className="vl vl-care">
      {(s, _rect, layout) => (
        <Phone width={layout === 'compact' ? 326 : 340} className="vl-phone">
          <Thread className="vl-thread">
            <Stamp className="vl-date">Thứ Hai tuần trước</Stamp>
            <Bubble from="me">
              Cây về tới rồi nha vườn.
              <Time>09:12</Time>
            </Bubble>
            <Bubble from="them" avatar={<Shop />}>
              Dạ, cây có gì lạ cứ nhắn vườn nhé.
              <Time>09:30</Time>
            </Bubble>
            <Bubble from="me">
              Ổn lắm, cảm ơn vườn!
              <Time>09:41</Time>
            </Bubble>
            <Stamp className="vl-date">19:05 Hôm nay</Stamp>
            {s.sent && (
              <Bubble from="me" source="draft">
                {MINE}
                <Time>19:05</Time>
              </Bubble>
            )}
            <Receipt show={s.receipt}>{s.seen ? 'Đã xem' : 'Đã nhận'}</Receipt>
            {(s.typing || s.reply) && (
              <Bubble from="them" typing={s.typing} avatar={<Shop />}>
                Lá già dưới gốc vàng rồi rụng là bình thường ạ.
                <Time>19:07</Time>
              </Bubble>
            )}
            {s.more && (
              <Bubble from="them" avatar={<Shop />}>
                Nếu lá non cũng vàng, bạn giãn tưới ra 10 ngày một lần nhé.
                <Time>19:07</Time>
              </Bubble>
            )}
          </Thread>
          <Composer draft={s.draft} caret />
        </Phone>
      )}
    </Stage>
  )
}
