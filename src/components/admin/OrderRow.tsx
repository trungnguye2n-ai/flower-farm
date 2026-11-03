'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { setOrderStatusAction } from '@/app/admin/(app)/don-hang/actions'
import type { OrderStatus, OrderView } from '@/admin/orders'
import { ORDER_STATUS_VALUES as ORDER_STATUSES, telLink, zaloLink } from '@/admin/order-links'
import { STATUS_LABEL } from './order-format'
import { useToast } from './Toast'
import { money } from './types'

type Row = Omit<OrderView, 'createdAt'> & { createdAt: string; when: string }

const spring = { type: 'spring', bounce: 0, duration: 0.32 } as const

/** One order: tap to see everything; the status pill opens the four choices in place. */
export function OrderRow({ order }: { order: Row }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [status, setStatus] = useState<OrderStatus>(order.status)

  async function choose(next: OrderStatus) {
    setPicking(false)
    if (next === status) return
    const before = status
    setStatus(next)
    const r = await setOrderStatusAction(order.id, next).catch(() => ({ ok: false as const }))
    if (!r.ok) {
      setStatus(before)
      toast('Chưa đổi được trạng thái, thử lại', { tone: 'error' })
    }
  }

  return (
    <motion.li layout="position" className={`order ${open ? 'open' : ''}`} transition={spring}>
      <div className="order-top">
        <button className="order-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="order-line">
            <span className="order-code">{order.code}</span>
            <span className="order-when">{order.when}</span>
          </span>
          <b className="order-name">{order.customerName}</b>
        </button>
        <div className="order-side">
          <span className="order-total">{money(order.total)}</span>
          <button
            className={`status s-${status} press`}
            onClick={() => setPicking(!picking)}
            aria-expanded={picking}
            aria-label={`Trạng thái: ${STATUS_LABEL[status]}. Đổi trạng thái`}
          >
            {STATUS_LABEL[status]}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div className="status-pick" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            <div role="group" aria-label="Chọn trạng thái">
              {ORDER_STATUSES.map((s) => (
                <button key={s} className={`status s-${s} press`} aria-pressed={s === status} onClick={() => choose(s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="order-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            <div className="order-inner">
              <ul className="order-items">
                {order.items.map((i, k) => (
                  <li key={k}>
                    <span>
                      {i.quantity} × {i.productName} <i>{i.variantName}</i>
                    </span>
                    <span>{money(i.unitPrice * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <Contact label="Người đặt" name={order.customerName} phone={order.customerPhone} />
              {order.recipientPhone && <Contact label="Người nhận" name={order.recipientName ?? ''} phone={order.recipientPhone} />}
              <dl className="order-facts">
                {order.deliveryAddress && (
                  <>
                    <dt>Giao tới</dt>
                    <dd>{order.deliveryAddress}</dd>
                  </>
                )}
                {order.deliveryTime && (
                  <>
                    <dt>Thời gian</dt>
                    <dd>{order.deliveryTime}</dd>
                  </>
                )}
                {order.note && (
                  <>
                    <dt>Lời nhắn</dt>
                    <dd className="note">{order.note}</dd>
                  </>
                )}
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function Contact({ label, name, phone }: { label: string; name: string; phone: string }) {
  return (
    <div className="contact">
      <span>
        <small>{label}</small>
        <b>{name}</b> {phone}
      </span>
      <a className="btn quiet small" href={telLink(phone)}>
        Gọi
      </a>
      <a className="btn small zalo" href={zaloLink(phone)} target="_blank" rel="noreferrer">
        Zalo
      </a>
    </div>
  )
}
