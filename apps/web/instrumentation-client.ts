import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://2d361f38110445e3b6a34aa996292515@priovex-app.centralindia.cloudapp.azure.com/1',
  environment: process.env.NODE_ENV ?? 'production',
  tracesSampleRate: 0.01,
});
