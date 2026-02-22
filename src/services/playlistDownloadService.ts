import JSZip from 'jszip';
import { getPlaylistById, listAllTracks, type OfflineTrack } from './offlineDb';

const ASSET_CACHE = 'suno-architect-assets-v1';

const sanitizeName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

const inferAudioExtension = (url: string, mimeType: string) => {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('aac')) return 'aac';
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.wav')) return 'wav';
    if (pathname.endsWith('.ogg')) return 'ogg';
    if (pathname.endsWith('.aac')) return 'aac';
  } catch {
    // Ignore URL parse failures and default below.
  }
  return 'mp3';
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const getCachedAudio = async (audioUrl: string): Promise<Response | null> => {
  if (!('caches' in window)) return null;
  const cache = await caches.open(ASSET_CACHE);
  const request = new Request(audioUrl, { method: 'GET', mode: 'cors' });
  const response = await cache.match(request, { ignoreVary: true });
  if (response) return response;
  return (await cache.match(audioUrl, { ignoreVary: true })) ?? null;
};

export interface ZipDownloadResult {
  added: number;
  skipped: number;
}

export async function downloadTracksZipFromCache(
  collectionName: string,
  trackIds: string[],
  collectionType: 'album' | 'playlist'
): Promise<ZipDownloadResult> {
  const allTracks = await listAllTracks();
  const byId = new Map(allTracks.map((track) => [track.id, track]));
  const tracks = trackIds.map((id) => byId.get(id)).filter(Boolean) as OfflineTrack[];

  const zip = new JSZip();
  const audioFolder = zip.folder('audio');
  if (!audioFolder) throw new Error('Failed to create ZIP audio folder.');

  let added = 0;
  let skipped = 0;

  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    if (!track.audioUrl) {
      skipped += 1;
      continue;
    }

    const cachedResponse = await getCachedAudio(track.audioUrl);
    if (!cachedResponse) {
      skipped += 1;
      continue;
    }

    const blob = await cachedResponse.blob();
    const extension = inferAudioExtension(track.audioUrl, blob.type || 'audio/mpeg');
    const safeTitle = sanitizeName(track.title || `track-${index + 1}`) || `track-${index + 1}`;
    const filename = `${String(index + 1).padStart(2, '0')}-${safeTitle}.${extension}`;
    audioFolder.file(filename, blob, { binary: true });
    added += 1;
  }

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        type: collectionType,
        title: collectionName,
        exportedAt: new Date().toISOString(),
        requestedTrackCount: trackIds.length,
        addedTrackCount: added,
        skippedTrackCount: skipped,
        trackIds,
      },
      null,
      2
    )
  );

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const safeCollection = sanitizeName(collectionName || collectionType.toUpperCase()) || collectionType;
  downloadBlob(zipBlob, `${safeCollection}.zip`);

  return { added, skipped };
}

export async function downloadPlaylistZipFromCache(playlistId: string): Promise<ZipDownloadResult> {
  const playlist = await getPlaylistById(playlistId);
  if (!playlist) {
    throw new Error('Playlist not found in offline IndexedDB. Sync it first in offline mode.');
  }
  return downloadTracksZipFromCache(playlist.title || `playlist-${playlist.id}`, playlist.trackIds || [], 'playlist');
}
