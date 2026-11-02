/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sql.js', '@libsql/client'],
  compress: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/:path/', destination: '/:path/index.html' },
    ]
  },
  async headers() {
    return [
      // Quran corpus — never changes, cache it forever in the browser + CDN.
      {
        source: '/data/quran/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Lists that an admin can edit (duas, topics, books…). Short browser
      // cache + long stale-while-revalidate window: instant repeat visits, and
      // edits still show up within a minute.
      {
        source: '/data/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=604800' }],
      },
      {
        source: '/data/books.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=604800' }],
      },
      // Both web fonts are content-hashed by name and never change.
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

module.exports = nextConfig
