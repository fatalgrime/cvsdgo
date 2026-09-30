import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/site/help", "/site/privacy", "/site/terms"],
        disallow: ["/api/", "/site/link-manager", "/site/status", "/site/support", "/site/users", "/sign-in"],
      },
    ],
    sitemap: "https://go.cvsd.live/sitemap.xml",
    host: "https://go.cvsd.live",
  };
}

