import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Proxy removed - app now writes directly to Supabase tables
    // Edge functions are still available but not required for client-side operations
    // Security: Enable CORS only for trusted origins in development
    cors: mode === 'development',
    // Security: Stricter headers in dev
    headers: {
      'X-Content-Type-Options': 'nosniff',
    },
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Dedupe React to prevent multiple instances (fixes createContext undefined)
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Production optimizations
    target: 'es2020',
    minify: mode === 'production' ? 'terser' : false,
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
        passes: 2, // Multiple compression passes for better optimization
        dead_code: true,
        unused: true,
      },
      mangle: {
        safari10: true, // Safari 10 compatibility
      },
      format: {
        comments: false, // Remove all comments
      },
    } : undefined,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'scheduler'],
          'web3-core': ['viem', 'wagmi', '@tanstack/react-query'],
          'ui-components': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip', '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
        // Optimize chunk file names with content hash for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
      // Tree-shaking optimization
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
      },
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Inline small assets (< 4KB) for fewer HTTP requests
    assetsInlineLimit: 4096,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Source maps: hidden for production (uploaded to error tracking), none otherwise
    sourcemap: mode === 'production' ? 'hidden' : mode !== 'production',
    // Report compressed size in build output
    reportCompressedSize: true,
    // CSS minification
    cssMinify: mode === 'production' ? 'esbuild' : false,
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'lucide-react',
      'clsx',
      'tailwind-merge',
    ],
    exclude: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
    // Discover deps early for faster dev startup
    holdUntilCrawlEnd: false,
  },
  // Preview server configuration (for testing production builds locally)
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
  },
  // Environment variable prefix security
  envPrefix: 'VITE_',
  // Define globals for production
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}));
