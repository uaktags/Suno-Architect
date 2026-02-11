import { LibraryAlbum } from '../types';

interface SongMetaResponse {
  songId: string;
  tags: string[];
  albums: Array<{ id: number; name: string }>;
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

export async function listAlbums(): Promise<LibraryAlbum[]> {
  const data = await request<{ albums: LibraryAlbum[] }>('/api/library/albums', { method: 'GET' });
  return data.albums || [];
}

export async function createAlbum(name: string, description?: string): Promise<void> {
  await request('/api/library/albums', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function addSongToAlbum(albumId: number, songId: string, title?: string): Promise<void> {
  await request(`/api/library/albums/${albumId}/songs`, {
    method: 'POST',
    body: JSON.stringify({ songId, title }),
  });
}

export async function removeSongFromAlbum(albumId: number, songId: string): Promise<void> {
  await request(`/api/library/albums/${albumId}/songs/${encodeURIComponent(songId)}`, {
    method: 'DELETE',
  });
}

export async function reorderAlbumSongs(albumId: number, songIds: string[]): Promise<void> {
  await request(`/api/library/albums/${albumId}/songs/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ songIds }),
  });
}

export async function getSongMeta(songId: string): Promise<SongMetaResponse> {
  return request<SongMetaResponse>(`/api/library/songs/${encodeURIComponent(songId)}/meta`, { method: 'GET' });
}

export async function setSongTags(songId: string, tags: string[]): Promise<void> {
  await request(`/api/library/songs/${encodeURIComponent(songId)}/meta`, {
    method: 'PUT',
    body: JSON.stringify({ tags }),
  });
}
