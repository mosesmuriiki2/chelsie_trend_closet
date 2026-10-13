export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://chelsietrendcloset.com';
  return [{ url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 }];
}
