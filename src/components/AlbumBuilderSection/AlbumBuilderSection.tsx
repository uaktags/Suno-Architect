import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SunoClip } from '../../types';
import { listAllTracks, OfflineAlbum, OfflineTrack, upsertAlbums } from '../../services/offlineDb';
import { downloadTracksZipFromCache } from '../../services/playlistDownloadService';

type AlbumType = 'EP' | 'LP' | 'GreatestHits';

interface AlbumBuilderSectionProps {
  history: SunoClip[];
}

interface BuilderTrack {
  id: string;
  title: string;
  imageUrl: string;
  durationMs: number;
  cachedLocally: boolean;
  source: 'indexeddb' | 'history';
}

const LIBRARY_ROW_HEIGHT = 76;
const LIBRARY_OVERSCAN = 6;

const formatDuration = (durationMs: number) => {
  if (!durationMs || durationMs <= 0) return '--:--';
  const totalSeconds = Math.floor(durationMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const mapOfflineTrack = (track: OfflineTrack): BuilderTrack => ({
  id: track.id,
  title: track.title || 'UNTITLED',
  imageUrl: track.imageUrl,
  durationMs: track.metadata?.durationMs || 0,
  cachedLocally: track.cachedLocally,
  source: 'indexeddb',
});

const mapHistoryTrack = (clip: SunoClip): BuilderTrack => ({
  id: clip.id,
  title: clip.title || 'UNTITLED',
  imageUrl: clip.imageUrl || clip.imageLargeUrl || '',
  durationMs: (clip.metadata?.duration || 0) * 1000,
  cachedLocally: false,
  source: 'history',
});

const LibraryRow: React.FC<{ track: BuilderTrack }> = ({ track }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library:${track.id}`,
    data: { kind: 'library', trackId: track.id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="h-[68px] p-2 border border-slate-700 bg-black text-slate-200 flex items-center gap-3 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-cyan-300"
      aria-label={`Library track ${track.title}`}
    >
      <img
        src={track.imageUrl || 'https://placehold.co/120x120/000000/ffffff?text=NO+ART'}
        alt=""
        className="w-12 h-12 object-cover border border-slate-600"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wide truncate">{track.title}</p>
        <p className="text-[10px] uppercase text-slate-400 tracking-widest flex gap-2">
          <span>{track.cachedLocally ? 'Cached' : 'Remote'}</span>
          <span>{formatDuration(track.durationMs)}</span>
        </p>
      </div>
    </div>
  );
};

const BuilderSortableRow: React.FC<{
  track: BuilderTrack;
  index: number;
  onRemove: (trackId: string) => void;
}> = ({ track, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `builder:${track.id}`,
    data: { kind: 'builder', trackId: track.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-2 border border-cyan-700 bg-slate-950/70 flex items-center gap-3"
    >
      <span className="text-xs text-cyan-300 w-7 text-right tabular-nums">{index + 1}</span>
      <button
        type="button"
        className="text-left flex-1 min-w-0"
        {...listeners}
        {...attributes}
        aria-label={`Reorder ${track.title}`}
      >
        <p className="text-xs font-semibold truncate">{track.title}</p>
        <p className="text-[10px] uppercase tracking-widest text-slate-400">{formatDuration(track.durationMs)}</p>
      </button>
      <button
        type="button"
        onClick={() => onRemove(track.id)}
        className="px-2 py-1 text-[10px] border border-red-400 text-red-300 hover:bg-red-950"
        aria-label={`Remove ${track.title}`}
      >
        REMOVE
      </button>
    </div>
  );
};

const AlbumBuilderSection: React.FC<AlbumBuilderSectionProps> = ({ history }) => {
  const [libraryTracks, setLibraryTracks] = useState<BuilderTrack[]>([]);
  const [builderTrackIds, setBuilderTrackIds] = useState<string[]>([]);
  const [activeDragTrackId, setActiveDragTrackId] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [albumType, setAlbumType] = useState<AlbumType>('EP');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [zipState, setZipState] = useState<'idle' | 'packing' | 'done' | 'error'>('idle');
  const [zipMessage, setZipMessage] = useState('');
  const [ariaLiveMessage, setAriaLiveMessage] = useState('Album builder ready.');
  const [libraryScrollTop, setLibraryScrollTop] = useState(0);
  const libraryContainerRef = useRef<HTMLDivElement | null>(null);
  const [libraryViewportHeight, setLibraryViewportHeight] = useState(500);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let mounted = true;

    const loadTracks = async () => {
      try {
        const offlineTracks = await listAllTracks();
        if (!mounted) return;

        const merged = new Map<string, BuilderTrack>();
        offlineTracks.forEach((track) => merged.set(track.id, mapOfflineTrack(track)));
        history.forEach((clip) => {
          if (!merged.has(clip.id)) merged.set(clip.id, mapHistoryTrack(clip));
        });

        setLibraryTracks(
          Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
        );
      } catch (error) {
        console.error('Failed loading offline library tracks', error);
      }
    };

    loadTracks();

    return () => {
      mounted = false;
    };
  }, [history]);

  useEffect(() => {
    if (!libraryContainerRef.current) return;
    const node = libraryContainerRef.current;
    setLibraryViewportHeight(node.clientHeight || 500);
    const observer = new ResizeObserver(() => {
      setLibraryViewportHeight(node.clientHeight || 500);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const trackById = useMemo(() => {
    const map = new Map<string, BuilderTrack>();
    libraryTracks.forEach((track) => map.set(track.id, track));
    return map;
  }, [libraryTracks]);

  const builderTracks = useMemo(
    () => builderTrackIds.map((id) => trackById.get(id)).filter(Boolean) as BuilderTrack[],
    [builderTrackIds, trackById]
  );

  const builderDrop = useDroppable({ id: 'builder-dropzone' });

  const totalLibraryHeight = libraryTracks.length * LIBRARY_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(libraryScrollTop / LIBRARY_ROW_HEIGHT) - LIBRARY_OVERSCAN);
  const visibleCount = Math.ceil(libraryViewportHeight / LIBRARY_ROW_HEIGHT) + LIBRARY_OVERSCAN * 2;
  const endIndex = Math.min(libraryTracks.length, startIndex + visibleCount);
  const visibleLibraryTracks = libraryTracks.slice(startIndex, endIndex);
  const topOffset = startIndex * LIBRARY_ROW_HEIGHT;

  const activeTrack = activeDragTrackId ? trackById.get(activeDragTrackId) : null;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTrackId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('library:')) {
      const trackId = activeId.replace('library:', '');
      if (overId === 'builder-dropzone' || overId.startsWith('builder:')) {
        setBuilderTrackIds((prev) => {
          if (prev.includes(trackId)) return prev;
          setAriaLiveMessage(`Added ${trackById.get(trackId)?.title || 'track'} to album builder.`);
          return [...prev, trackId];
        });
      }
      return;
    }

    if (activeId.startsWith('builder:') && overId.startsWith('builder:')) {
      const fromTrackId = activeId.replace('builder:', '');
      const toTrackId = overId.replace('builder:', '');
      setBuilderTrackIds((prev) => {
        const oldIndex = prev.indexOf(fromTrackId);
        const newIndex = prev.indexOf(toTrackId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
        setAriaLiveMessage(`Moved ${trackById.get(fromTrackId)?.title || 'track'} to position ${newIndex + 1}.`);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const onSaveAlbum = async () => {
    if (!albumTitle.trim() || builderTrackIds.length === 0) return;
    setSaveState('saving');
    setSaveMessage('Saving album to offline storage...');

    const now = Date.now();
    const nextAlbum: OfflineAlbum = {
      id: crypto.randomUUID(),
      title: albumTitle.trim(),
      description: albumDescription.trim(),
      coverArtUrl: builderTracks[0]?.imageUrl || '',
      type: albumType,
      trackIds: builderTrackIds,
      createdAt: now,
      updatedAt: now,
      raw: {
        source: 'album-builder-ui',
        tracks: builderTracks,
      },
    };

    try {
      await upsertAlbums([nextAlbum]);
      setSaveState('saved');
      setSaveMessage(`Saved album: ${nextAlbum.title}`);
      setAriaLiveMessage(`Album ${nextAlbum.title} saved successfully.`);
    } catch (error) {
      console.error('Album save failed', error);
      setSaveState('error');
      setSaveMessage('Failed to save album to IndexedDB.');
      setAriaLiveMessage('Album save failed.');
    }
  };

  const onDownloadAlbumZip = async () => {
    if (!builderTracks.length) return;
    setZipState('packing');
    setZipMessage('Building album ZIP from local cache...');
    try {
      const title = albumTitle.trim() || 'UNTITLED_ALBUM';
      const result = await downloadTracksZipFromCache(title, builderTrackIds, 'album');
      setZipState('done');
      setZipMessage(`ZIP created. Added ${result.added} tracks, skipped ${result.skipped} uncached tracks.`);
      setAriaLiveMessage(`Album ZIP exported. Added ${result.added} tracks.`);
    } catch (error) {
      console.error('Album ZIP export failed', error);
      setZipState('error');
      setZipMessage('Failed to build album ZIP from local cache.');
      setAriaLiveMessage('Album ZIP export failed.');
    }
  };

  return (
    <section className="w-full space-y-4 font-mono text-slate-100">
      <div className="border-2 border-slate-700 bg-black p-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-cyan-300">Album Builder // Phase 3</h2>
        <p className="text-xs text-slate-300 mt-2">
          Build structured albums from local library tracks. Drag from the left pane into the right assembly zone.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 border-2 border-slate-700 bg-black p-3 min-h-[560px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-[0.18em] text-slate-200">Library</h3>
            <span className="text-[10px] text-slate-400">{libraryTracks.length} tracks</span>
          </div>

          <div
            ref={libraryContainerRef}
            onScroll={(e) => setLibraryScrollTop(e.currentTarget.scrollTop)}
            className="h-[500px] overflow-y-auto border border-slate-700 bg-slate-950"
          >
            <div style={{ height: totalLibraryHeight, position: 'relative' }}>
              <div style={{ transform: `translateY(${topOffset}px)` }} className="space-y-2 p-2">
                {visibleLibraryTracks.map((track) => (
                  <LibraryRow key={track.id} track={track} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 border-2 border-cyan-700 bg-slate-950 p-3 min-h-[560px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="ALBUM TITLE"
              className="md:col-span-2 h-10 px-3 bg-black border border-slate-700 text-xs uppercase tracking-wider placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <select
              value={albumType}
              onChange={(e) => setAlbumType(e.target.value as AlbumType)}
              className="h-10 px-3 bg-black border border-slate-700 text-xs uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Album type"
            >
              <option value="EP">EP</option>
              <option value="LP">LP</option>
              <option value="GreatestHits">Greatest Hits</option>
            </select>
          </div>

          <textarea
            value={albumDescription}
            onChange={(e) => setAlbumDescription(e.target.value)}
            placeholder="ALBUM DESCRIPTION"
            className="w-full h-20 p-3 mb-3 bg-black border border-slate-700 text-xs uppercase tracking-wide placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />

          <DndContext
            sensors={sensors}
            onDragStart={(event) => {
              const id = String(event.active.id);
              if (id.startsWith('library:')) setActiveDragTrackId(id.replace('library:', ''));
              if (id.startsWith('builder:')) setActiveDragTrackId(id.replace('builder:', ''));
            }}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveDragTrackId(null)}
          >
            <div
              ref={builderDrop.setNodeRef}
              className={`border-2 min-h-[360px] p-2 ${
                builderDrop.isOver ? 'border-cyan-300 bg-cyan-950/20' : 'border-cyan-700'
              }`}
            >
              <SortableContext
                items={builderTrackIds.map((id) => `builder:${id}`)}
                strategy={verticalListSortingStrategy}
              >
                {builderTracks.length === 0 && (
                  <div className="h-full min-h-[330px] grid place-items-center text-xs uppercase tracking-[0.2em] text-slate-500 border border-dashed border-slate-700 bg-black/30">
                    Drop tracks here to build album
                  </div>
                )}

                <div className="space-y-2">
                  {builderTracks.map((track, index) => (
                    <BuilderSortableRow
                      key={track.id}
                      track={track}
                      index={index}
                      onRemove={(trackId) => {
                        setBuilderTrackIds((prev) => prev.filter((id) => id !== trackId));
                        setAriaLiveMessage(`Removed ${trackById.get(trackId)?.title || 'track'} from album builder.`);
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>

            <DragOverlay>
              {activeTrack ? (
                <div className="w-[280px] p-2 border border-cyan-300 bg-black/95 text-xs">
                  <p className="font-bold truncate">{activeTrack.title}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{formatDuration(activeTrack.durationMs)}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              {builderTracks.length} tracks • {albumType}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownloadAlbumZip}
                disabled={builderTrackIds.length === 0 || zipState === 'packing'}
                className="h-10 px-4 border border-amber-300 text-xs font-bold uppercase tracking-[0.16em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-300/10"
              >
                {zipState === 'packing' ? 'Packing ZIP...' : 'Download Album ZIP'}
              </button>
              <button
                type="button"
                onClick={onSaveAlbum}
                disabled={!albumTitle.trim() || builderTrackIds.length === 0 || saveState === 'saving'}
                className="h-10 px-4 border border-cyan-300 text-xs font-bold uppercase tracking-[0.16em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-300/10"
              >
                {saveState === 'saving' ? 'Saving...' : 'Save Album'}
              </button>
            </div>
          </div>

          <div className="mt-2 min-h-6" role="status" aria-live="polite">
            {saveMessage && (
              <p
                className={`text-xs ${
                  saveState === 'saved'
                    ? 'text-emerald-300'
                    : saveState === 'error'
                      ? 'text-red-300'
                      : 'text-slate-300'
                }`}
              >
                {saveMessage}
              </p>
            )}
            {zipMessage && (
              <p
                className={`text-xs ${
                  zipState === 'done'
                    ? 'text-emerald-300'
                    : zipState === 'error'
                      ? 'text-red-300'
                      : 'text-slate-300'
                }`}
              >
                {zipMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {ariaLiveMessage}
      </div>
    </section>
  );
};

export default AlbumBuilderSection;
