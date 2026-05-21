import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/toaster';
import { QueryProvider } from '@/components/providers/query-provider';
import { SentryInit } from '@/components/sentry-init';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'PrioVex.AI — AI Patent Prior Art Search',
    template: '%s | PrioVex.AI',
  },
  description:
    'Enterprise-grade AI-powered patent prior art search. Find relevant prior art, assess patentability, and generate professional reports in minutes.',
  keywords: ['patent search', 'prior art', 'patentability', 'AI patent', 'USPTO'],
  authors: [{ name: 'PrioVex.AI' }],
  openGraph: {
    type: 'website',
    siteName: 'PrioVex.AI',
    title: 'PrioVex.AI — AI Patent Prior Art Search',
    description: 'Enterprise AI-powered patent prior art search platform',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <QueryProvider>
            <SentryInit />
            {children}
            <Toaster />
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
