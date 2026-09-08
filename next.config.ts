import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP_RELAX_FOR_HTTP=true loosens prod CSP for plain-HTTP deploys:
//   - allow 'unsafe-inline' for Next.js hydration scripts
//   - drop `upgrade-insecure-requests` (would rewrite asset URLs to https://)
//   - drop HSTS header (would pin the browser to https:// for 2 years)
// REMOVE THIS once HTTPS is in place. The proper fix is per-request nonces
// in middleware + a valid TLS cert.
const cspRelaxForHttp = process.env.CSP_RELAX_FOR_HTTP === "true";

const scriptSrc =
  isDev || cspRelaxForHttp
    ? `'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`
    : `'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`;

const cspDirectives = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://firebasestorage.googleapis.com https://fcm.googleapis.com`,
  `frame-src https://www.google.com/recaptcha/`,
  `worker-src 'self' blob:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
];
if (!cspRelaxForHttp) {
  cspDirectives.push(`upgrade-insecure-requests`);
}
const csp = cspDirectives.join("; ").trim();

const securityHeaders: Array<{ key: string; value: string }> = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
];
if (!cspRelaxForHttp) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

// Behind CloudFront the origin server sees x-forwarded-host as the raw EC2
// hostname, which won't match the browser's Origin (the CloudFront domain).
// Next.js blocks Server Actions on that mismatch, so allowlist the public host.
// Comma-separated SERVER_ACTIONS_ALLOWED_ORIGINS lets us add hosts without a
// code change; the CloudFront domain is included by default.
const serverActionsAllowedOrigins = [
  "d2bags9w7bkgzw.cloudfront.net",
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mariadb"],
  experimental: {
    serverActions: {
      allowedOrigins: serverActionsAllowedOrigins,
    },
  },
  // The deploy runner is resource-constrained; running tsc inline in
  // `next build` there makes builds crawl. Type-check already runs as a
  // separate gate in ci.yml, so skip the duplicate work during the prod build.
  // (Next 16 no longer runs ESLint during `next build`, so no eslint key here.)
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "appleid.cdn-apple.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
