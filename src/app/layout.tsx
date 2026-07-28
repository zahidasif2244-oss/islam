import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Islam360 Web Portal',
  description: 'Quran, Hadith, Duas and more',
  icons: [{ rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="bg-[#f5f5f5] text-[#333] font-sans">{children}</body>
    </html>
  )
}
