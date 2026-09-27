// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Keep the bottom-center search control accessible in the local preview.
  devToolbar: { enabled: false },
  // Public content lives in Cloudflare Pages Functions, outside Astro.
  // These public endpoints make the local preview show the current site content.
  vite: {
    server: {
      proxy: {
        '/api/credits': { target: 'https://jetsullivan.com', changeOrigin: true },
        '/api/acting-credits': { target: 'https://jetsullivan.com', changeOrigin: true },
        '/api/media-entries/': { target: 'https://jetsullivan.com', changeOrigin: true },
        '/api/content/': { target: 'https://jetsullivan.com', changeOrigin: true },
        '/api/gear': { target: 'https://jetsullivan.com', changeOrigin: true },
        '/api/media/': { target: 'https://jetsullivan.com', changeOrigin: true },
      },
    },
  },
  build: {
    inlineStylesheets: 'always',
  },
});
