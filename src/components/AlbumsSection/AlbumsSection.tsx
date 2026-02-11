import React, { useEffect, useMemo, useState } from 'react';
import { LibraryAlbum, SunoClip } from '../../types';
import { listAlbums, reorderAlbumSongs } from '../../services/libraryService';

interface AlbumsSectionProps {
  history: SunoClip[];
}

const AlbumsSection: React.FC<AlbumsSectionProps> = ({ history }) => {
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const historyTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const clip of history) {
      const title = clip.title || clip.originalData?.title;
      if (title) map.set(clip.id, title);
    }
    return map;
  }, [history]);

  const loadAlbums = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAlbums();
      setAlbums(data);
      setSelectedAlbumId((prev) => {
        if (!data.length) return null;
        if (prev && data.some((a) => a.id === prev)) return prev;
        return data[0].id;
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load albums');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, []);

  const selectedAlbum = useMemo(
    () => albums.find((a) => a.id === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  );

  const moveTrack = async (fromIndex: number, toIndex: number) => {
    if (!selectedAlbum) return;
    if (toIndex < 0 || toIndex >= selectedAlbum.songs.length || fromIndex === toIndex) return;

    const previousSongs = selectedAlbum.songs;
    const reordered = [...previousSongs];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setAlbums((prev) =>
      prev.map((album) =>
        album.id === selectedAlbum.id
          ? {
              ...album,
              songs: reordered.map((song, idx) => ({ ...song, sortOrder: idx })),
            }
          : album
      )
    );

    setSaving(true);
    setError(null);
    try {
      await reorderAlbumSongs(selectedAlbum.id, reordered.map((song) => song.songId));
    } catch (e: any) {
      setAlbums((prev) =>
        prev.map((album) =>
          album.id === selectedAlbum.id
            ? {
                ...album,
                songs: previousSongs,
              }
            : album
        )
      );
      setError(e?.message || 'Failed to reorder tracks');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/30 p-6 text-sm text-slate-300">
        Loading library albums...
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold text-white">Albums Library</h2>
        <p className="text-sm text-slate-400 mt-1">
          Browse all albums and reorder tracks with library-wide control.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {albums.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-700">
          <p className="text-slate-400">No albums yet.</p>
          <p className="text-xs text-slate-500 mt-1">Create albums from track details in History, then manage them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 rounded-2xl border border-slate-700/70 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Albums</span>
              <span className="text-xs text-slate-500">{albums.length}</span>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
              {albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbumId(album.id)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                    selectedAlbumId === album.id
                      ? 'border-purple-500/60 bg-purple-500/10'
                      : 'border-slate-700/70 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold text-white truncate">{album.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{album.songs.length} track{album.songs.length === 1 ? '' : 's'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-2xl border border-slate-700/70 bg-slate-900/40 p-4">
            {!selectedAlbum ? (
              <div className="text-sm text-slate-400">Select an album.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-slate-700/70 pb-3 mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedAlbum.name}</h3>
                    {selectedAlbum.description && (
                      <p className="text-sm text-slate-400 mt-1">{selectedAlbum.description}</p>
                    )}
                  </div>
                  <button
                    onClick={loadAlbums}
                    disabled={saving}
                    className="text-xs rounded-md border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {selectedAlbum.songs.length === 0 ? (
                  <p className="text-sm text-slate-400">This album has no tracks.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAlbum.songs.map((song, index) => (
                      <div
                        key={`${selectedAlbum.id}:${song.songId}`}
                        className="rounded-xl border border-slate-700/70 bg-slate-800/40 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 font-semibold">#{index + 1}</div>
                          <div className="text-sm font-medium text-white truncate">
                            {song.title || historyTitleById.get(song.songId) || 'Untitled'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{song.songId}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => moveTrack(index, index - 1)}
                            disabled={saving || index === 0}
                            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                          >
                            Up
                          </button>
                          <button
                            onClick={() => moveTrack(index, index + 1)}
                            disabled={saving || index === selectedAlbum.songs.length - 1}
                            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                          >
                            Down
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumsSection;
