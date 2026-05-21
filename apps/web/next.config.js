const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
process.env.NEXT_TELEMETRY_DISABLED = '1';

const nextConfig = {
  output: 'standalone',

  transpilePackages: ['@priovex/types', '@priovex/database', '@priovex/queue'],

  serverExternalPackages: ['@prisma/client', 'bullmq', 'ioredis'],
  outputFileTracingRoot: require('path').join(__dirname, '../../'),

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.priovex.ai",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://img.clerk.com https://*.blob.core.windows.net",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.clerk.accounts.dev https://*.blob.core.windows.net https://clerk-telemetry.com",
              "frame-src 'self' https://*.clerk.accounts.dev",
              "worker-src 'self' blob:",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Source map upload disabled — self-hosted GlitchTip, not Sentry Cloud.
  // Client sends directly to /api/1/ on the same origin; Nginx proxies it to
  // the glitchtip-web container. No tunnel needed.
  silent: true,
  disableLogger: true,
  hideSourceMaps: true,
  sourcemaps: { disable: true },
});
