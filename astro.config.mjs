// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // The public collection lives in Cloudflare Pages Functions, outside Astro.
  // Read-only proxies make the local preview use the same gear and images.
  vite: {
    server: {
      proxy: {
        '/api/gear': { target: 'https://jetsullivan.com', changeOrigin: true },
        '/api/media/': { target: 'https://jetsullivan.com', changeOrigin: true },
      },
    },
  },
  build: {
    inlineStylesheets: 'always',
  },
});
