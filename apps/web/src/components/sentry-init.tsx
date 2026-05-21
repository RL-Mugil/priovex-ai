'use client';
// Explicit import ensures sentry.client.config.ts runs in the browser bundle
// regardless of whether the webpack plugin auto-injection is active.
import '../../../sentry.client.config';

export function SentryInit() {
  return null;
}
