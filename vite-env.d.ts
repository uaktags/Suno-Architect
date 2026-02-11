/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENAPI_API_KEY?: string;
  readonly VITE_OPENAPI_BASE_URL?: string;
  readonly VITE_AI_PROVIDER_TYPE?: string;
  readonly VITE_AI_PROVIDER_MODEL?: string;
  readonly VITE_SUNO_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
