import { getSunoFeed, getSunoPlaylist } from './sunoApi';
import {
  OfflinePlaylist,
  OfflineTrack,
  getSyncMeta,
  listAllTracks,
  setSyncMeta,
  upsertPlaylists,
  upsertTracks,
} from './offlineDb';

export interface SyncProgress {
  phase: 'fetching' | 'diffing' | 'upserting' | 'caching-assets' | 'done';
  completed: number;
  total: number;
  message: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  failedAssets: number;
}

const LAST_SYNC_META_KEY = 'lastSyncAt';

const toTags = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
};

const buildTrack = (clip: any, now: number, prev?: OfflineTrack): OfflineTrack => {
  const metadata = clip?.metadata || {};
  const audioUrl = clip?.audio_url || clip?.song_path || clip?.audioUrl || '';
  const imageUrl = clip?.image_large_url || clip?.image_url || '';
  return {
    id: clip.id,
    sunoId: clip.id,
    title: clip.title || 'Untitled',
    audioUrl,
    imageUrl,
    metadata: {
      tags: toTags(metadata.tags),
      prompt: metadata.prompt || '',
      durationMs: Math.round((metadata.duration || 0) * 1000),
    },
    cachedLocally: prev?.cachedLocally || false,
    raw: clip,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
};

const isTrackEqual = (a: OfflineTrack, b: OfflineTrack) => {
  return (
    a.title === b.title &&
    a.audioUrl === b.audioUrl &&
    a.imageUrl === b.imageUrl &&
    a.metadata.prompt === b.metadata.prompt &&
    a.metadata.durationMs === b.metadata.durationMs &&
    a.metadata.tags.join('|') === b.metadata.tags.join('|')
  );
};

const collectAssetUrls = (tracks: OfflineTrack[]): string[] => {
  const urls = new Set<string>();
  for (const track of tracks) {
    if (track.audioUrl) urls.add(track.audioUrl);
    if (track.imageUrl) urls.add(track.imageUrl);
  }
  return [...urls];
};

async function requestCacheAssets(urls: string[], onProgress?: (p: SyncProgress) => void): Promise<number> {
  if (!urls.length || !('serviceWorker' in navigator)) return 0;

  const registration = await navigator.serviceWorker.ready;
  if (!registration.active) return urls.length;

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let failedAssets = 0;

  await new Promise<void>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'CACHE_PROGRESS' || data.requestId !== requestId) return;

      onProgress?.({
        phase: data.done ? 'done' : 'caching-assets',
        completed: data.completed,
        total: data.total,
        message: `Caching assets ${data.completed}/${data.total}`,
      });

      if (data.done) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
        resolve();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    registration.active?.postMessage({ type: 'CACHE_ASSETS', urls, requestId });
  });

  // Conservative fallback estimation for cross-origin failures, if any URLs still uncached.
  if ('caches' in window) {
    caches.open('suno-architect-assets-v1').then(async (cache) => {
      const checks = await Promise.all(
        urls.map(async (url) => {
          try {
            const hit = await cache.match(url, { ignoreVary: true });
            return !!hit;
          } catch {
            return false;
          }
        })
      );
      failedAssets = checks.filter((x) => !x).length;
    });
  }

  return failedAssets;
}

export async function downloadAccountCache(
  cookie: string,
  playlistIds: string[] = [],
  onProgress?: (p: SyncProgress) => void
): Promise<SyncResult> {
  onProgress?.({ phase: 'fetching', completed: 0, total: 1, message: 'Fetching remote account metadata…' });
  const feed = await getSunoFeed(cookie, 200);
  const remoteClips = Array.isArray(feed?.clips) ? feed.clips : [];

  const remotePlaylists: OfflinePlaylist[] = [];
  if (playlistIds.length) {
    for (let i = 0; i < playlistIds.length; i += 1) {
      const id = playlistIds[i];
      try {
        const pl = await getSunoPlaylist(id, cookie);
        const playlistClips = Array.isArray(pl?.playlist_clips) ? pl.playlist_clips : [];
        remotePlaylists.push({
          id,
          title: pl?.name || `Playlist ${id}`,
          description: pl?.description || '',
          coverArtUrl: pl?.image_url,
          trackIds: playlistClips.map((entry: any) => entry?.clip?.id).filter(Boolean),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          raw: pl,
        });
      } catch {
        // Partial failure allowed.
      }
      onProgress?.({ phase: 'fetching', completed: i + 1, total: playlistIds.length, message: `Fetched playlists ${i + 1}/${playlistIds.length}` });
    }
  }

  onProgress?.({ phase: 'diffing', completed: 0, total: remoteClips.length, message: 'Diffing remote vs local state…' });
  const localTracks = await listAllTracks();
  const localMap = new Map(localTracks.map((t) => [t.id, t]));

  const now = Date.now();
  const toWrite: OfflineTrack[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  remoteClips.forEach((clip: any, idx: number) => {
    const prev = localMap.get(clip.id);
    const next = buildTrack(clip, now, prev);
    if (!prev) {
      added += 1;
      toWrite.push(next);
    } else if (!isTrackEqual(prev, next)) {
      updated += 1;
      toWrite.push(next);
    } else {
      unchanged += 1;
    }
    onProgress?.({ phase: 'diffing', completed: idx + 1, total: remoteClips.length, message: `Compared ${idx + 1}/${remoteClips.length} tracks` });
  });

  onProgress?.({ phase: 'upserting', completed: 0, total: toWrite.length, message: 'Persisting metadata to IndexedDB…' });
  await upsertTracks(toWrite);
  await upsertPlaylists(remotePlaylists);
  await setSyncMeta(LAST_SYNC_META_KEY, now);

  const refreshedLocal = await listAllTracks();
  const assetUrls = collectAssetUrls(refreshedLocal);
  const failedAssets = await requestCacheAssets(assetUrls, onProgress);

  onProgress?.({ phase: 'done', completed: 1, total: 1, message: 'Account cache is up to date.' });
  return { added, updated, unchanged, failedAssets };
}

export const getLastAccountSync = async (): Promise<number | undefined> => {
  return getSyncMeta<number>(LAST_SYNC_META_KEY);
};

