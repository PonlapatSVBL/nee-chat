import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const BRAND = '#085796'; // token: --primary
const svg = (maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="${BRAND}"/>
  <path d="M150 268l64 64 148-148" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

mkdirSync('public/icons', { recursive: true });
await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(svg(true))).resize(512, 512).png().toFile('public/icons/icon-512-maskable.png');
console.log('icons written to public/icons');
