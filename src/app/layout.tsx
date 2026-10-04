import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { Toaster } from '@/presentation/components/ui/sonner';
import './globals.css';

const font = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'หนี้ชัด', template: '%s · หนี้ชัด' },
  description: 'บันทึกทุกการจ่าย ตรวจสอบทุกยอด',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'หนี้ชัด', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff', // --background (oklch(1 0 0)); see docs/design/tokens.md
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={font.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
