import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://islam-pearl-zeta.vercel.app'),
  title: {
    default: 'Quran Web — Quran, Hadith, Duas & Islamic Knowledge Online',
    template: '%s | Quran Web',
  },
  description:
    'Read the Holy Quran with Arabic, Urdu and English, authentic Hadith collections, Duas with meaning, Tafseer, Islamic books and topics — free and available online on Quran Web.',
  keywords: [
    'Quran',
    'Hadith',
    'Duas',
    'Dua',
    'Islam',
    'Holy Quran',
    'Quran in Urdu',
    'Quran in Arabic',
    'Hadith collection',
    'Tafseer',
    'Islamic knowledge',
    'Islamic books',
    'Prayer',
    'Salah',
    'Islamic topics',
    'Quran Web',
  ],
  applicationName: 'Quran Web',
  authors: [{ name: 'Quran Web', url: 'https://islam-pearl-zeta.vercel.app' }],
  creator: 'Ali Raza',
  publisher: 'Quran Web',
  category: 'Islamic Education',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'ur_PK',
    url: 'https://islam-pearl-zeta.vercel.app',
    siteName: 'Quran Web',
    title: 'Quran Web — Quran, Hadith, Duas & Islamic Knowledge Online',
    description:
      'Read the Holy Quran with Arabic, Urdu and English, authentic Hadith collections, Duas with meaning, Tafseer, Islamic books and topics — free and available online.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Quran Web — Quran, Hadith, Duas & Islamic Knowledge Online' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quran Web — Quran, Hadith, Duas & Islamic Knowledge Online',
    description:
      'Read the Holy Quran with Arabic, Urdu and English, authentic Hadith collections, Duas with meaning, Tafseer, Islamic books and topics — free and available online.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: [{ rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* Self-hosted fonts only — the old render-blocking Google Fonts
            stylesheet cost ~2 s before first paint. Arabic (NooreHuda, 71 KB)
            is used above the fold, so it is preloaded; the Urdu Nastaliq face
            (159 KB) is pulled in by CSS only when Urdu text actually renders. */}
        <link rel="preload" href="/fonts/noorehuda.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="bg-[#f5f5f5] text-[#333] font-sans">{children}</body>
    </html>
  )
}
