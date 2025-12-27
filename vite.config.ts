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
        pure_funcs: ['console.log', 'console.info'],
      },
    } : undefined,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'scheduler'],
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
