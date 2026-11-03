import type { OrderStatus } from '@/admin/orders'

export const STATUS_LABEL: Record<OrderStatus, string> = { new: 'Mới', confirmed: 'Đã xác nhận', delivered: 'Đã giao', cancelled: 'Đã huỷ' }
/** URL value for each status filter (Vietnamese, readable in the address bar). */
export const STATUS_PARAM: Record<OrderStatus, string> = { new: 'moi', confirmed: 'da-xac-nhan', delivered: 'da-giao', cancelled: 'da-huy' }

const TZ = 'Asia/Ho_Chi_Minh'
const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })

/** "14:05 · hôm nay", "09:30 · hôm qua", "14:05 · 28/10" in Vietnam time. */
export function orderTime(at: Date, now = new Date()): string {
  const time = at.toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  const yesterday = new Date(now.getTime() - 86_400_000)
  const when =
    day(at) === day(now)
      ? 'hôm nay'
      : day(at) === day(yesterday)
        ? 'hôm qua'
        : day(at).slice(8, 10) + '/' + day(at).slice(5, 7)
  return `${time} · ${when}`
}
