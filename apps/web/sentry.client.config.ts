import * as Sentry from '@sentry/nextjs';

// DSN targets the GlitchTip container via Docker-internal network.
// tunnelRoute (/monitoring) means the browser never contacts glitchtip-web
// directly — Next.js proxies the envelopes server-side.
Sentry.init({
  dsn: 'http://2d361f38110445e3b6a34aa996292515@glitchtip-web:8000/1',
  environment: process.env.NODE_ENV ?? 'production',
  tracesSampleRate: 0.01,
});
