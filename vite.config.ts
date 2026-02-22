import path from 'path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787';
  const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version || '0.0.0';

  const ciCommit =
    process.env.VITE_APP_COMMIT ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA;

  let appCommit = ciCommit ? String(ciCommit).trim().slice(0, 7) : 'local';
  if (!appCommit || appCommit === 'local') {
    try {
      appCommit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      appCommit = 'local';
    }
  }

  return {
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
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_COMMIT': JSON.stringify(appCommit),
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
