import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
      react(),
      tailwindcss(),
  ], 
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
    'import.meta.env.VITE_OPENROUTER_API_KEY': JSON.stringify(process.env.OPENROUTER_API_KEY),
    'import.meta.env.VITE_OPENAPI_API_KEY': JSON.stringify(process.env.OPENAPI_API_KEY),
    'import.meta.env.VITE_OPENAPI_BASE_URL': JSON.stringify(process.env.OPENAPI_BASE_URL),
    'import.meta.env.VITE_AI_PROVIDER_TYPE': JSON.stringify(process.env.AI_PROVIDER_TYPE),
    'import.meta.env.VITE_AI_PROVIDER_MODEL': JSON.stringify(process.env.AI_PROVIDER_MODEL),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
