import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups"
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site"
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1"
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none"
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://maps.googleapis.com https://challenges.cloudflare.com https://js.stripe.com https://checkout.stripe.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://region1.google-analytics.com https://maps.googleapis.com https://*.googleapis.com https://api.stripe.com https://checkout.stripe.com https://*.stripe.com",
      "media-src 'self' blob: https:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-src https://challenges.cloudflare.com https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://*.stripe.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : [])
    ].join("; ")
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\" \"https://checkout.stripe.com\"), usb=(), interest-cohort=()"
  },
  ...(process.env.NODE_ENV === "production"
    ? [{
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload"
      }]
    : [])
];

const nextConfig: NextConfig = {
  // Keep development artifacts separate from production builds. Running
  // `next dev` after `next build` in the same .next directory can leave the
  // manifests pointing at assets that the dev compiler has already removed.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": ["./public/maskines-email-brand-light-v3.png"]
  },
  // PDFKit loads its built-in AFM font files from its own package directory.
  // Keep it external to the Next server bundle so those runtime assets remain
  // available for receipt generation in API routes and webhooks.
  serverExternalPackages: ["pdfkit"],
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: true
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [96, 160, 240, 320, 480],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" }
    ]
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "no-store, max-age=0"
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow"
          }
        ]
      },
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico)",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      // Social preview images are generated from live listing data. Override
      // the generic immutable asset policy so a removed listing image cannot
      // remain in a browser or CDN cache for a year.
      {
        source: "/og/listing/:id/preview.jpg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, must-revalidate"
          }
        ]
      },
      {
        source: "/maskines-email-brand-v2.png",
        headers: [
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin"
          }
        ]
      },
      {
        source: "/maskines-icon-v2.png",
        headers: [
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin"
          }
        ]
      },
      {
        source: "/maskines-brand-share-v2.png",
        headers: [
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin"
          }
        ]
      }
    ];
  },
  webpack(config, { dev }) {
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        chunkIds: "deterministic",
        concatenateModules: true,
        mangleExports: "deterministic",
        moduleIds: "deterministic",
        providedExports: true,
        usedExports: true
      };
    }

    return config;
  }
};

export default nextConfig;
