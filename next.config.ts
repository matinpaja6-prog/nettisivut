import type { NextConfig } from "next";
import { createHash } from "crypto";

function shortCssModuleName(resourcePath: string, exportName: string) {
  const hash = createHash("sha256")
    .update(`${resourcePath}:${exportName}`)
    .digest("base64url")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 8);

  return `_${hash}`;
}

function obscureCssModuleNames(rule: unknown) {
  if (!rule || typeof rule !== "object") return;

  const candidate = rule as {
    oneOf?: unknown[];
    rules?: unknown[];
    use?: unknown;
    loader?: string;
    options?: {
      modules?: {
        getLocalIdent?: (
          context: { resourcePath?: string },
          localIdentName: string,
          exportName: string
        ) => string;
      };
    };
  };

  const nestedRules = [...(candidate.oneOf ?? []), ...(candidate.rules ?? [])];
  nestedRules.forEach(obscureCssModuleNames);

  const uses = Array.isArray(candidate.use)
    ? candidate.use
    : candidate.use
      ? [candidate.use]
      : [];

  uses.forEach(obscureCssModuleNames);

  if (
    typeof candidate.loader === "string" &&
    candidate.loader.includes("css-loader") &&
    candidate.options?.modules?.getLocalIdent
  ) {
    candidate.options.modules.getLocalIdent = (context, _localIdentName, exportName) =>
      shortCssModuleName(context.resourcePath ?? "", exportName);
  }
}

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
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  }
];

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
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
      ...(!process.env.VERCEL
        ? [
            {
              source: "/((?!_next/static|_next/image|.*\\.(?:svg|jpg|jpeg|png|webp|avif|gif|ico)$).*)",
              headers: [
                ...securityHeaders,
                {
                  key: "Cache-Control",
                  value: "no-store, max-age=0, must-revalidate"
                }
              ]
            }
          ]
        : []),
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
      }
    ];
  },
  webpack(config, { dev }) {
    if (!dev) {
      config.module?.rules?.forEach(obscureCssModuleNames);
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
