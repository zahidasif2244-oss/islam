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
}

module.exports = nextConfig
