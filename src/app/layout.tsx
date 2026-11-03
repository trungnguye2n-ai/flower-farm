import type { ReactNode } from 'react'
import { Bricolage_Grotesque } from 'next/font/google'
import './theme.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  axes: ['opsz', 'wdth'],
  variable: '--font-bricolage',
  display: 'swap',
})

export const metadata = { title: 'Vườn hoa' }
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' as const }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={bricolage.variable}>
      <body>{children}</body>
    </html>
  )
}
