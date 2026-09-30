import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: "https://go.cvsd.live", lastModified, changeFrequency: "daily", priority: 1 },
    { url: "https://go.cvsd.live/site/help", lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: "https://go.cvsd.live/site/privacy", lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: "https://go.cvsd.live/site/terms", lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];
}

