import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'หนี้ชัด',
    short_name: 'หนี้ชัด',
    description: 'บันทึกทุกการจ่าย ตรวจสอบทุกยอด',
    lang: 'th',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff', // token: --background
    theme_color: '#085796', // token: --primary (stamp ink)
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
