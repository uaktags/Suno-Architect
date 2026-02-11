import { ProviderType } from '../types';

interface ApiKeyResponse {
  apiKey?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }

  return body as T;
}

export async function getServerApiKey(providerType: ProviderType): Promise<string | undefined> {
  const data = await request<ApiKeyResponse>(`/api/keys/${providerType}`, { method: 'GET' });
  return data.apiKey;
}

export async function setServerApiKey(providerType: ProviderType, apiKey: string): Promise<void> {
  await request<{ success: boolean }>(`/api/keys/${providerType}`, {
    method: 'PUT',
    body: JSON.stringify({ apiKey }),
  });
}

export async function deleteServerApiKey(providerType: ProviderType): Promise<void> {
  await request<{ success: boolean }>(`/api/keys/${providerType}`, { method: 'DELETE' });
}
