import * as Sentry from '@sentry/nextjs';

// Browser sends directly to the same HTTPS origin — Nginx routes /api/1/ to
// the glitchtip-web container. Same-origin so CSP connect-src 'self' covers it.
Sentry.init({
  dsn: 'https://2d361f38110445e3b6a34aa996292515@priovex-app.centralindia.cloudapp.azure.com/1',
  environment: process.env.NODE_ENV ?? 'production',
  tracesSampleRate: 0.01,
});
