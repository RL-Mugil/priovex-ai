import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'http://2d361f38110445e3b6a34aa996292515@glitchtip-web:8000/1',
  environment: process.env.NODE_ENV ?? 'production',
  tracesSampleRate: 0.01,
});
