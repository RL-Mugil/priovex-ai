export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@sentry/nextjs');
    init({
      dsn: process.env.SENTRY_DSN || undefined,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0.1,
      enabled: !!process.env.SENTRY_DSN,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { init } = await import('@sentry/nextjs');
    init({
      dsn: process.env.SENTRY_DSN || undefined,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0.1,
      enabled: !!process.env.SENTRY_DSN,
    });
  }
}
