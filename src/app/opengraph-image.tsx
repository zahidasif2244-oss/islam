import { ImageResponse } from 'next/og'

export const alt =
  'Quran Web — Quran, Hadith, Duas & Islamic Knowledge Online'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const logo =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23e8b840" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/><path d="M9 11h5"/></svg>'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0e3b24 0%, #1a5c3a 50%, #2a7a4e 100%)',
          color: '#ffffff',
          padding: 60,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 130,
            height: 130,
            marginBottom: 34,
          }}
        >
          <img
            src={logo}
            alt=""
            width={130}
            height={130}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 78,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Quran Web
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 34,
            opacity: 0.92,
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          Quran • Hadith • Duas • Tafseer • Islamic Books &amp; Topics
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            fontSize: 26,
            opacity: 0.75,
          }}
        >
          islam-pearl-zeta.vercel.app
        </div>
      </div>
    ),
    { ...size },
  )
}