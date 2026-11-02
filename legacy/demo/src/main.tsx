import { createRoot } from 'react-dom/client'
import type { ComponentType } from 'react'
import VuonLanOrder from './order'
import VuonLanPhoto from './photo'
import VuonLanCare from './care'

// Each demo mounts into its slot on index.html, if the slot is there
const slots: [string, ComponentType][] = [
  ['order-demo', VuonLanOrder],
  ['photo-demo', VuonLanPhoto],
  ['care-demo', VuonLanCare],
]
for (const [id, Demo] of slots) {
  const el = document.getElementById(id)
  if (el) createRoot(el).render(<Demo />)
}
