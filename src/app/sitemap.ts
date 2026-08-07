import type { MetadataRoute } from 'next'

const BASE = 'https://islam-pearl-zeta.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/privacy/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/dua-shifa/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]
}