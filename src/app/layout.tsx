import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { AuthHydration } from '@/components/auth/AuthHydration';
import MatomoTracker from '@/components/analytics/MatomoTracker';
import { ApiUrlDebug } from '@/components/ApiUrlDebug';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MinhaSIP - PABX Empresarial',
  description: 'Sistema completo de gerenciamento PABX empresarial',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script src="/jssip.min.js"></script>
        {/* Matomo - Analytics */}
        <Script id="matomo-tracking" strategy="afterInteractive">
          {`
            var _paq = window._paq = window._paq || [];
            _paq.push(['trackPageView']);
            _paq.push(['enableLinkTracking']);
            (function() {
              var u='${process.env.NEXT_PUBLIC_MATOMO_URL || 'http://38.51.135.180:8080'}/';
              _paq.push(['setTrackerUrl', u+'matomo.php']);
              _paq.push(['setSiteId', '${process.env.NEXT_PUBLIC_MATOMO_SITE_ID || '1'}']);
              var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
              g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
            })();
          `}
        </Script>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ToastProvider>
          <AuthHydration>
            {children}
          </AuthHydration>
          {/* Track SPA navigations */}
          <MatomoTracker />
        </ToastProvider>
        <ApiUrlDebug />
      </body>
    </html>
  );
}
