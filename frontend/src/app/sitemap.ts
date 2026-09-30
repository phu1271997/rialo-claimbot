import type { MetadataRoute } from 'next';

const BASE = 'https://rialo-claimbot-five.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/policies', '/claims', '/claims/new'].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
