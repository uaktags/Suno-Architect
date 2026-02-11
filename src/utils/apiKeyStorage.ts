import { ProviderType } from '../types';

const API_KEY_STORAGE_KEYS: Record<ProviderType, string> = {
  gemini: 'gemini_api_key',
  openrouter: 'openrouter_api_key',
  openapi: 'openapi_api_key',
};

export type ApiKeyStorageMode = 'client' | 'server' | 'both';

const KEY_STORAGE_MODE_KEY = 'ai_provider_key_storage_modes';

export function getApiKeyForProvider(providerType: ProviderType): string | undefined {
  const storageKey = API_KEY_STORAGE_KEYS[providerType];
  const stored = localStorage.getItem(storageKey);
  return stored || undefined;
}

export function saveApiKeyForProvider(providerType: ProviderType, apiKey: string | undefined): void {
  const storageKey = API_KEY_STORAGE_KEYS[providerType];
  if (apiKey) {
    localStorage.setItem(storageKey, apiKey);
  } else {
    localStorage.removeItem(storageKey);
  }
}

export function getEnvApiKeyForProvider(providerType: ProviderType): string | undefined {
  switch (providerType) {
    case 'gemini':
      return import.meta.env.VITE_GEMINI_API_KEY || undefined;
    case 'openrouter':
      return import.meta.env.VITE_OPENROUTER_API_KEY || undefined;
    case 'openapi':
      return import.meta.env.VITE_OPENAPI_API_KEY || undefined;
    default:
      return undefined;
  }
}

export function getApiKey(providerType: ProviderType): string | undefined {
  return getApiKeyForProvider(providerType) || getEnvApiKeyForProvider(providerType);
}

function parseStorageModes(raw: string | null): Partial<Record<ProviderType, ApiKeyStorageMode>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ProviderType, ApiKeyStorageMode>>;
    return parsed || {};
  } catch {
    return {};
  }
}

export function getApiKeyStorageMode(providerType: ProviderType): ApiKeyStorageMode {
  const parsed = parseStorageModes(localStorage.getItem(KEY_STORAGE_MODE_KEY));
  return parsed[providerType] || 'client';
}

export function setApiKeyStorageMode(providerType: ProviderType, mode: ApiKeyStorageMode): void {
  const parsed = parseStorageModes(localStorage.getItem(KEY_STORAGE_MODE_KEY));
  parsed[providerType] = mode;
  localStorage.setItem(KEY_STORAGE_MODE_KEY, JSON.stringify(parsed));
}
