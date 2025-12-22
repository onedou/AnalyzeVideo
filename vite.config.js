import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      strict: false
    }
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers', 'onnxruntime-web', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  worker: {
    format: 'es'
  },
  assetsInclude: ['**/*.wasm', '**/*.mjs'],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
