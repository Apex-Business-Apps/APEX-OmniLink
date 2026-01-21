import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';

// Multi-page static site configuration
// PWA Configuration
import { VitePWA } from 'vite-plugin-pwa';

// Multi-page static site configuration
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apex-badge.svg', 'apex-header-logo.png'],
      manifest: {
        name: 'APEX OmniHub',
        short_name: 'OmniHub',
        description: 'APEX OmniHub - Intelligence, Designed.',
        theme_color: '#0f1729',
        background_color: '#0f1729',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'apex-badge.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'apex-header-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        demo: resolve(__dirname, 'demo.html'),
        'tech-specs': resolve(__dirname, 'tech-specs.html'),
        'request-access': resolve(__dirname, 'request-access.html'),
        login: resolve(__dirname, 'login.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
      },
      output: {
        // Consistent asset naming for caching
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // Performance optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    // Enable source maps for debugging in production (hidden)
    sourcemap: 'hidden',
    // CSS code splitting
    cssCodeSplit: true,
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
});
