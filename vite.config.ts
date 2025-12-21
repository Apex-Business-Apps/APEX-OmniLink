import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Conditionally import lovable-tagger if available
let componentTagger: (() => any) | undefined;
try {
  const tagger = await import("lovable-tagger");
  componentTagger = tagger.componentTagger;
} catch {
  // lovable-tagger not available, skip it
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Proxy removed - app now writes directly to Supabase tables
    // Edge functions are still available but not required for client-side operations
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Production optimizations
    target: 'es2020',
    minify: mode === 'production' ? 'terser' : false,
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
    } : undefined,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Code splitting for better caching
          if (id.includes('node_modules')) {
            // Vendor chunks
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@radix-ui') || id.includes('@radix')) {
              return 'vendor-ui';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // Other large dependencies
            return 'vendor-other';
          }
          // Split by route/page for better code splitting
          if (id.includes('/pages/')) {
            const match = id.match(/\/pages\/([^/]+)/);
            if (match) {
              return `page-${match[1]}`;
            }
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    sourcemap: mode !== 'production', // Source maps only for non-production
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
    ],
    exclude: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
  },
}));
