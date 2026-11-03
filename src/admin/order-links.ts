// Pure helpers shared by the server and the browser (no database imports here).
export const ORDER_STATUS_VALUES = ['new', 'confirmed', 'delivered', 'cancelled'] as const
export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number]

const dial = (phone: string) => phone.replace(/[^\d+]/g, '')
export const zaloLink = (phone: string) => `https://zalo.me/${dial(phone).replace(/^\+/, '')}`
export const telLink = (phone: string) => `tel:${dial(phone)}`
