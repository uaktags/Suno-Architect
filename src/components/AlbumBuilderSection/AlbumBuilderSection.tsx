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
import {
  deleteAlbumById,
  listAlbumsByUpdatedAtDesc,
  listAllTracks,
  OfflineAlbum,
  OfflineTrack,
  upsertAlbums,
} from '../../services/offlineDb';
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

type LibraryAvailabilityFilter = 'all' | 'cached' | 'remote';
type LibrarySortMode = 'title-asc' | 'title-desc' | 'duration-asc' | 'duration-desc';

const LIBRARY_ROW_HEIGHT = 76;
const LIBRARY_OVERSCAN = 6;
const ALBUM_BUILDER_DRAFT_STORAGE_KEY = 'suno-architect:album-builder-draft:v1';

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return '--';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '--';
  }
};

const sanitizeAlbumType = (value: unknown): AlbumType => {
  if (value === 'EP' || value === 'LP' || value === 'GreatestHits') return value;
  return 'EP';
};

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

const LibraryRow: React.FC<{
  track: BuilderTrack;
  isSelected?: boolean;
  isAlreadyInBuilder?: boolean;
  onToggleSelected?: (trackId: string) => void;
  onAddToBuilder?: (trackId: string) => void;
}> = ({ track, isSelected = false, isAlreadyInBuilder = false, onToggleSelected, onAddToBuilder }) => {
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
      className={`h-[68px] p-2 border bg-black text-slate-200 flex items-center gap-3 ${
        isSelected ? 'border-cyan-300' : 'border-[var(--app-panel-border)]'
      }`}
      aria-label={`Library track ${track.title}`}
    >
      <button
        type="button"
        onClick={() => onToggleSelected?.(track.id)}
        className={`w-4 h-4 border grid place-items-center text-[10px] ${
          isSelected ? 'border-cyan-300 text-cyan-200 bg-cyan-500/20' : 'border-slate-500 text-transparent'
        }`}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? 'Deselect' : 'Select'} ${track.title}`}
      >
        ✓
      </button>
      <img
        src={track.imageUrl || 'https://placehold.co/120x120/000000/ffffff?text=NO+ART'}
        alt=""
        className="w-12 h-12 object-cover border border-slate-600"
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="w-full text-left cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-cyan-300"
          aria-label={`Drag ${track.title} into album builder`}
        >
          <p className="text-xs font-bold tracking-wide truncate">{track.title}</p>
        </button>
        <p className="text-[10px] uppercase text-slate-400 tracking-widest flex gap-2">
          <span>{track.cachedLocally ? 'Cached' : 'Remote'}</span>
          <span>{formatDuration(track.durationMs)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => onAddToBuilder?.(track.id)}
        disabled={isAlreadyInBuilder}
        className="px-2 py-1 text-[10px] border border-cyan-400 text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-950"
        aria-label={`${isAlreadyInBuilder ? 'Already added' : 'Add'} ${track.title} to album builder`}
      >
        {isAlreadyInBuilder ? 'ADDED' : 'ADD'}
      </button>
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
  const [selectedLibraryTrackIds, setSelectedLibraryTrackIds] = useState<string[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<OfflineAlbum[]>([]);
  const [selectedSavedAlbumId, setSelectedSavedAlbumId] = useState('');
  const [pendingDeleteAlbumId, setPendingDeleteAlbumId] = useState<string | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [savedAlbumsState, setSavedAlbumsState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [savedAlbumsMessage, setSavedAlbumsMessage] = useState('');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryAvailabilityFilter, setLibraryAvailabilityFilter] = useState<LibraryAvailabilityFilter>('all');
  const [librarySortMode, setLibrarySortMode] = useState<LibrarySortMode>('title-asc');
  const [activeDragTrackId, setActiveDragTrackId] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [albumType, setAlbumType] = useState<AlbumType>('EP');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [zipState, setZipState] = useState<'idle' | 'packing' | 'done' | 'error'>('idle');
  const [zipMessage, setZipMessage] = useState('');
  const [ariaLiveMessage, setAriaLiveMessage] = useState('Album builder ready.');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [libraryScrollTop, setLibraryScrollTop] = useState(0);
  const libraryContainerRef = useRef<HTMLDivElement | null>(null);
  const importAlbumInputRef = useRef<HTMLInputElement | null>(null);
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

  const refreshSavedAlbums = async (preserveSelected = true) => {
    setSavedAlbumsState('loading');
    setSavedAlbumsMessage('');
    try {
      const albums = await listAlbumsByUpdatedAtDesc();
      setSavedAlbums(albums);
      setSavedAlbumsState('idle');
      setSelectedSavedAlbumId((prev) => {
        if (!preserveSelected) return albums[0]?.id || '';
        if (prev && albums.some((album) => album.id === prev)) return prev;
        return albums[0]?.id || '';
      });
    } catch (error) {
      console.error('Failed loading saved albums', error);
      setSavedAlbumsState('error');
      setSavedAlbumsMessage('Failed to load saved offline albums.');
    }
  };

  useEffect(() => {
    void refreshSavedAlbums(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(ALBUM_BUILDER_DRAFT_STORAGE_KEY);
      if (!raw) {
        setDraftHydrated(true);
        return;
      }
      const draft = JSON.parse(raw) as {
        builderTrackIds?: string[];
        albumTitle?: string;
        albumDescription?: string;
        albumType?: AlbumType;
      };

      if (Array.isArray(draft.builderTrackIds)) setBuilderTrackIds(draft.builderTrackIds.filter(Boolean));
      if (typeof draft.albumTitle === 'string') setAlbumTitle(draft.albumTitle);
      if (typeof draft.albumDescription === 'string') setAlbumDescription(draft.albumDescription);
      setAlbumType(sanitizeAlbumType(draft.albumType));
    } catch (error) {
      console.error('Failed to hydrate album builder draft', error);
    } finally {
      setDraftHydrated(true);
    }
  }, []);

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
  const filteredLibraryTracks = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();

    const filtered = libraryTracks.filter((track) => {
      if (libraryAvailabilityFilter === 'cached' && !track.cachedLocally) return false;
      if (libraryAvailabilityFilter === 'remote' && track.cachedLocally) return false;
      if (!query) return true;
      return track.title.toLowerCase().includes(query) || track.id.toLowerCase().includes(query);
    });

    filtered.sort((a, b) => {
      switch (librarySortMode) {
        case 'title-desc':
          return b.title.localeCompare(a.title, undefined, { sensitivity: 'base' });
        case 'duration-asc':
          return (a.durationMs || 0) - (b.durationMs || 0);
        case 'duration-desc':
          return (b.durationMs || 0) - (a.durationMs || 0);
        case 'title-asc':
        default:
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
    });

    return filtered;
  }, [libraryTracks, libraryQuery, libraryAvailabilityFilter, librarySortMode]);
  const selectedLibraryTrackIdSet = useMemo(() => new Set(selectedLibraryTrackIds), [selectedLibraryTrackIds]);
  const builderTrackIdSet = useMemo(() => new Set(builderTrackIds), [builderTrackIds]);
  const totalBuilderDurationMs = useMemo(
    () => builderTracks.reduce((total, track) => total + (track.durationMs || 0), 0),
    [builderTracks]
  );

  const builderDrop = useDroppable({ id: 'builder-dropzone' });

  const totalLibraryHeight = filteredLibraryTracks.length * LIBRARY_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(libraryScrollTop / LIBRARY_ROW_HEIGHT) - LIBRARY_OVERSCAN);
  const visibleCount = Math.ceil(libraryViewportHeight / LIBRARY_ROW_HEIGHT) + LIBRARY_OVERSCAN * 2;
  const endIndex = Math.min(filteredLibraryTracks.length, startIndex + visibleCount);
  const visibleLibraryTracks = filteredLibraryTracks.slice(startIndex, endIndex);
  const topOffset = startIndex * LIBRARY_ROW_HEIGHT;

  const activeTrack = activeDragTrackId ? trackById.get(activeDragTrackId) : null;
  const selectedSavedAlbum = useMemo(
    () => savedAlbums.find((album) => album.id === selectedSavedAlbumId) || null,
    [savedAlbums, selectedSavedAlbumId]
  );
  const isDeleteConfirmArmed = !!selectedSavedAlbum && pendingDeleteAlbumId === selectedSavedAlbum.id;

  useEffect(() => {
    setPendingDeleteAlbumId(null);
  }, [selectedSavedAlbumId]);

  const addTrackToBuilder = (trackId: string) => {
    setBuilderTrackIds((prev) => {
      if (prev.includes(trackId)) return prev;
      setAriaLiveMessage(`Added ${trackById.get(trackId)?.title || 'track'} to album builder.`);
      return [...prev, trackId];
    });
  };

  const addSelectedTracksToBuilder = () => {
    if (selectedLibraryTrackIds.length === 0) return;
    let addedCount = 0;
    setBuilderTrackIds((prev) => {
      const next = [...prev];
      const existing = new Set(prev);
      selectedLibraryTrackIds.forEach((trackId) => {
        if (!existing.has(trackId)) {
          next.push(trackId);
          existing.add(trackId);
          addedCount += 1;
        }
      });
      return next;
    });
    if (addedCount > 0) {
      setAriaLiveMessage(`Added ${addedCount} selected tracks to album builder.`);
      setSelectedLibraryTrackIds([]);
    } else {
      setAriaLiveMessage('Selected tracks are already in the album builder.');
    }
  };

  const clearDraftAlbum = () => {
    setBuilderTrackIds([]);
    setEditingAlbumId(null);
    setPendingDeleteAlbumId(null);
    setAriaLiveMessage('Cleared draft album track list.');
  };

  const removeTracksAlreadyInBuilderFromSelection = () => {
    setSelectedLibraryTrackIds((prev) => prev.filter((id) => !builderTrackIdSet.has(id)));
  };

  useEffect(() => {
    if (!draftHydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        ALBUM_BUILDER_DRAFT_STORAGE_KEY,
        JSON.stringify({
          builderTrackIds,
          albumTitle,
          albumDescription,
          albumType,
        })
      );
    } catch (error) {
      console.error('Failed to persist album builder draft', error);
    }
  }, [draftHydrated, builderTrackIds, albumTitle, albumDescription, albumType]);

  useEffect(() => {
    if (libraryTracks.length === 0) return;
    const validTrackIds = new Set(libraryTracks.map((track) => track.id));
    setBuilderTrackIds((prev) => prev.filter((id) => validTrackIds.has(id)));
    setSelectedLibraryTrackIds((prev) => prev.filter((id) => validTrackIds.has(id)));
  }, [libraryTracks]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTrackId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('library:')) {
      const trackId = activeId.replace('library:', '');
      if (overId === 'builder-dropzone' || overId.startsWith('builder:')) {
        addTrackToBuilder(trackId);
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
    const targetAlbumId = editingAlbumId || crypto.randomUUID();
    const nextAlbum: OfflineAlbum = {
      id: targetAlbumId,
      title: albumTitle.trim(),
      description: albumDescription.trim(),
      coverArtUrl: builderTracks[0]?.imageUrl || '',
      type: albumType,
      trackIds: builderTrackIds,
      createdAt: savedAlbums.find((album) => album.id === targetAlbumId)?.createdAt || now,
      updatedAt: now,
      raw: {
        source: 'album-builder-ui',
        tracks: builderTracks,
      },
    };

    try {
      await upsertAlbums([nextAlbum]);
      await refreshSavedAlbums(true);
      setEditingAlbumId(nextAlbum.id);
      setSelectedSavedAlbumId(nextAlbum.id);
      setSaveState('saved');
      setSaveMessage(`${editingAlbumId ? 'Updated' : 'Saved'} album: ${nextAlbum.title}`);
      setAriaLiveMessage(`Album ${nextAlbum.title} ${editingAlbumId ? 'updated' : 'saved'} successfully.`);
    } catch (error) {
      console.error('Album save failed', error);
      setSaveState('error');
      setSaveMessage('Failed to save album to IndexedDB.');
      setAriaLiveMessage('Album save failed.');
    }
  };

  const loadSavedAlbumIntoDraft = (album: OfflineAlbum) => {
    setAlbumTitle(album.title || '');
    setAlbumDescription(album.description || '');
    setAlbumType(sanitizeAlbumType(album.type));
    setBuilderTrackIds(Array.isArray(album.trackIds) ? album.trackIds : []);
    setEditingAlbumId(album.id);
    setSaveState('idle');
    setSaveMessage(`Loaded album: ${album.title}`);
    setZipState('idle');
    setZipMessage('');
    setAriaLiveMessage(`Loaded saved album ${album.title} into builder.`);
  };

  const startNewDraftFromCurrent = () => {
    setEditingAlbumId(null);
    setSaveState('idle');
    setSaveMessage('Current draft detached from saved album. Next save will create a new album.');
    setAriaLiveMessage('Draft detached from saved album.');
  };

  const duplicateSavedAlbumToNewDraft = (album: OfflineAlbum) => {
    const copyTitle = album.title ? `${album.title} (Copy)` : 'UNTITLED (Copy)';
    setAlbumTitle(copyTitle);
    setAlbumDescription(album.description || '');
    setAlbumType(sanitizeAlbumType(album.type));
    setBuilderTrackIds(Array.isArray(album.trackIds) ? [...album.trackIds] : []);
    setEditingAlbumId(null);
    setSaveState('idle');
    setSaveMessage(`Duplicated album into new draft: ${copyTitle}`);
    setAriaLiveMessage(`Duplicated ${album.title || 'album'} into a new draft.`);
  };

  const onDeleteSelectedSavedAlbum = async () => {
    if (!selectedSavedAlbum) return;
    if (pendingDeleteAlbumId !== selectedSavedAlbum.id) {
      setPendingDeleteAlbumId(selectedSavedAlbum.id);
      setAriaLiveMessage(`Delete armed for ${selectedSavedAlbum.title || 'selected album'}. Press delete again to confirm.`);
      return;
    }
    const albumToDelete = selectedSavedAlbum;
    try {
      await deleteAlbumById(albumToDelete.id);
      setPendingDeleteAlbumId(null);
      if (editingAlbumId === albumToDelete.id) {
        setEditingAlbumId(null);
        setSaveState('idle');
        setSaveMessage(`Deleted saved album ${albumToDelete.title}. Draft remains loaded as unsaved.`);
      } else {
        setSaveMessage(`Deleted album: ${albumToDelete.title}`);
      }
      setAriaLiveMessage(`Deleted saved album ${albumToDelete.title || 'album'}.`);
      await refreshSavedAlbums(false);
    } catch (error) {
      console.error('Failed deleting saved album', error);
      setSaveState('error');
      setSaveMessage('Failed to delete saved album.');
      setAriaLiveMessage('Failed to delete saved album.');
    }
  };

  const exportAlbumJson = (album: {
    id?: string;
    title: string;
    description: string;
    type: AlbumType;
    trackIds: string[];
    coverArtUrl?: string;
    createdAt?: number;
    updatedAt?: number;
  }) => {
    if (typeof window === 'undefined') return;
    const payload = {
      format: 'suno-architect-album',
      version: 1,
      exportedAt: Date.now(),
      album: {
        id: album.id || null,
        title: album.title,
        description: album.description,
        type: album.type,
        trackIds: album.trackIds,
        coverArtUrl: album.coverArtUrl || '',
        createdAt: album.createdAt || null,
        updatedAt: album.updatedAt || null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName = (album.title || 'untitled_album')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
    anchor.href = objectUrl;
    anchor.download = `${safeName || 'album'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const exportCurrentDraftJson = () => {
    exportAlbumJson({
      id: editingAlbumId || undefined,
      title: albumTitle.trim() || 'UNTITLED_ALBUM',
      description: albumDescription,
      type: albumType,
      trackIds: builderTrackIds,
      coverArtUrl: builderTracks[0]?.imageUrl || '',
      updatedAt: Date.now(),
    });
    setAriaLiveMessage('Exported current album draft as JSON.');
  };

  const onImportAlbumJsonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as any;
      const importedAlbum = parsed?.album ?? parsed;
      const importedTrackIds = Array.isArray(importedAlbum?.trackIds)
        ? importedAlbum.trackIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        : [];

      if (!importedTrackIds.length) {
        throw new Error('Album JSON is missing trackIds.');
      }

      setAlbumTitle(typeof importedAlbum?.title === 'string' ? importedAlbum.title : 'IMPORTED ALBUM');
      setAlbumDescription(typeof importedAlbum?.description === 'string' ? importedAlbum.description : '');
      setAlbumType(sanitizeAlbumType(importedAlbum?.type));
      setBuilderTrackIds(importedTrackIds);
      setEditingAlbumId(null);
      setSaveState('idle');
      setSaveMessage(`Imported album JSON: ${file.name}`);
      setZipState('idle');
      setZipMessage('');
      setAriaLiveMessage(`Imported album JSON ${file.name} into draft.`);
    } catch (error) {
      console.error('Failed importing album JSON', error);
      setSaveState('error');
      setSaveMessage('Failed to import album JSON.');
      setAriaLiveMessage('Album JSON import failed.');
    } finally {
      event.target.value = '';
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

  const selectedFilteredCount = useMemo(
    () => filteredLibraryTracks.reduce((count, track) => count + (selectedLibraryTrackIdSet.has(track.id) ? 1 : 0), 0),
    [filteredLibraryTracks, selectedLibraryTrackIdSet]
  );

  return (
    <section className="w-full space-y-4 font-mono text-slate-100">
      <div className="border-2 border-[var(--app-panel-border)] bg-black p-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-cyan-300">Album Builder // Phase 3</h2>
        <p className="text-xs text-slate-300 mt-2">
          Build structured albums from local library tracks. Drag from the left pane into the right assembly zone.
        </p>
      </div>

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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 border-2 border-[var(--app-panel-border)] bg-black p-3 min-h-[560px]">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h3 className="text-xs uppercase tracking-[0.18em] text-slate-200">Library</h3>
              <span className="text-[10px] text-slate-400">
                {filteredLibraryTracks.length}/{libraryTracks.length} tracks
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-2">
              <input
                value={libraryQuery}
                onChange={(e) => {
                  setLibraryQuery(e.target.value);
                  setLibraryScrollTop(0);
                  if (libraryContainerRef.current) libraryContainerRef.current.scrollTop = 0;
                }}
                placeholder="Search title or ID"
                className="h-9 px-3 bg-black border border-[var(--app-panel-border)] text-xs tracking-wide placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                aria-label="Search library tracks"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={libraryAvailabilityFilter}
                  onChange={(e) => {
                    setLibraryAvailabilityFilter(e.target.value as LibraryAvailabilityFilter);
                    setLibraryScrollTop(0);
                    if (libraryContainerRef.current) libraryContainerRef.current.scrollTop = 0;
                  }}
                  className="h-9 px-2 bg-black border border-[var(--app-panel-border)] text-[10px] uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  aria-label="Library availability filter"
                >
                  <option value="all">All Sources</option>
                  <option value="cached">Cached Only</option>
                  <option value="remote">Remote Only</option>
                </select>
                <select
                  value={librarySortMode}
                  onChange={(e) => setLibrarySortMode(e.target.value as LibrarySortMode)}
                  className="h-9 px-2 bg-black border border-[var(--app-panel-border)] text-[10px] uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  aria-label="Library sort order"
                >
                  <option value="title-asc">Title A-Z</option>
                  <option value="title-desc">Title Z-A</option>
                  <option value="duration-asc">Duration ↑</option>
                  <option value="duration-desc">Duration ↓</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedLibraryTrackIds((prev) => {
                    const next = new Set(prev);
                    filteredLibraryTracks.forEach((track) => next.add(track.id));
                    return Array.from(next);
                  });
                }}
                disabled={filteredLibraryTracks.length === 0}
                className="h-8 px-3 border border-slate-500 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-900"
              >
                Select Filtered ({selectedFilteredCount}/{filteredLibraryTracks.length})
              </button>
              <button
                type="button"
                onClick={addSelectedTracksToBuilder}
                disabled={selectedLibraryTrackIds.length === 0}
                className="h-8 px-3 border border-cyan-400 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-950"
              >
                Add Selected ({selectedLibraryTrackIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedLibraryTrackIds([])}
                disabled={selectedLibraryTrackIds.length === 0}
                className="h-8 px-3 border border-slate-500 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-900"
              >
                Clear Sel
              </button>
              <button
                type="button"
                onClick={removeTracksAlreadyInBuilderFromSelection}
                disabled={selectedLibraryTrackIds.length === 0}
                className="h-8 px-3 border border-amber-400 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-950/30"
              >
                Prune Sel
              </button>
            </div>

            <div
              ref={libraryContainerRef}
              onScroll={(e) => setLibraryScrollTop(e.currentTarget.scrollTop)}
              className="h-[500px] overflow-y-auto border border-[var(--app-panel-border)] bg-slate-950"
            >
              <div style={{ height: totalLibraryHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${topOffset}px)` }} className="space-y-2 p-2">
                  {filteredLibraryTracks.length === 0 && (
                    <div className="h-[120px] grid place-items-center text-xs uppercase tracking-[0.16em] text-slate-500 border border-dashed border-[var(--app-panel-border)]">
                      No tracks match current filters
                    </div>
                  )}
                  {visibleLibraryTracks.map((track) => (
                    <LibraryRow
                      key={track.id}
                      track={track}
                      isSelected={selectedLibraryTrackIdSet.has(track.id)}
                      isAlreadyInBuilder={builderTrackIdSet.has(track.id)}
                      onToggleSelected={(trackId) => {
                        setSelectedLibraryTrackIds((prev) =>
                          prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
                        );
                      }}
                      onAddToBuilder={addTrackToBuilder}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 border-2 border-cyan-700 bg-slate-950 p-3 min-h-[560px]">
          <div className="border border-[var(--app-panel-border)] bg-black/50 p-2 mb-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                Saved Offline Albums {editingAlbumId ? `• Editing ${savedAlbums.find((a) => a.id === editingAlbumId)?.title || 'Selected'}` : '• New Draft'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshSavedAlbums(true)}
                  className="h-8 px-3 border border-slate-500 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200 hover:bg-slate-900"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={startNewDraftFromCurrent}
                  disabled={!editingAlbumId}
                  className="h-8 px-3 border border-amber-400 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-950/30"
                >
                  Save As New
                </button>
                <button
                  type="button"
                  onClick={() => selectedSavedAlbum && duplicateSavedAlbumToNewDraft(selectedSavedAlbum)}
                  disabled={!selectedSavedAlbum}
                  className="h-8 px-3 border border-cyan-500 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-950/30"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={onDeleteSelectedSavedAlbum}
                  disabled={!selectedSavedAlbum}
                  className={`h-8 px-3 border text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDeleteConfirmArmed
                      ? 'border-red-300 bg-red-950/40 text-red-100'
                      : 'border-red-400 text-red-200 hover:bg-red-950/40'
                  }`}
                >
                  {isDeleteConfirmArmed ? 'Confirm Delete' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => selectedSavedAlbum && exportAlbumJson(selectedSavedAlbum)}
                  disabled={!selectedSavedAlbum}
                  className="h-8 px-3 border border-emerald-500 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-950/30"
                >
                  Export Selected JSON
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 mt-2">
              <select
                value={selectedSavedAlbumId}
                onChange={(e) => setSelectedSavedAlbumId(e.target.value)}
                className="h-9 px-2 bg-black border border-[var(--app-panel-border)] text-[10px] uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-400"
                aria-label="Select saved offline album"
              >
                <option value="">Select saved album...</option>
                {savedAlbums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title || 'UNTITLED'} • {album.trackIds?.length || 0} tracks • {album.type}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => selectedSavedAlbum && loadSavedAlbumIntoDraft(selectedSavedAlbum)}
                disabled={!selectedSavedAlbum || savedAlbumsState === 'loading'}
                className="h-9 px-3 border border-cyan-400 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-950"
              >
                Load Into Draft
              </button>
            </div>
            <div className="mt-2 min-h-4">
              {savedAlbumsState === 'loading' && <p className="text-xs text-slate-400">Loading saved albums...</p>}
              {savedAlbumsMessage && <p className="text-xs text-red-300">{savedAlbumsMessage}</p>}
              {isDeleteConfirmArmed && (
                <p className="text-xs text-red-300">Delete is armed. Press delete again to confirm, or change selection.</p>
              )}
              {selectedSavedAlbum && savedAlbumsState !== 'loading' && (
                <p className="text-[11px] text-slate-400">
                  Selected: <span className="text-slate-200">{selectedSavedAlbum.title || 'UNTITLED'}</span> •{' '}
                  {selectedSavedAlbum.trackIds?.length || 0} tracks • Updated {formatTimestamp(selectedSavedAlbum.updatedAt)}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input
              value={albumTitle}
              onChange={(e) => {
                setAlbumTitle(e.target.value);
                if (saveState !== 'idle') {
                  setSaveState('idle');
                  setSaveMessage('');
                }
              }}
              placeholder="ALBUM TITLE"
              className="md:col-span-2 h-10 px-3 bg-black border border-[var(--app-panel-border)] text-xs uppercase tracking-wider placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <select
              value={albumType}
              onChange={(e) => setAlbumType(e.target.value as AlbumType)}
              className="h-10 px-3 bg-black border border-[var(--app-panel-border)] text-xs uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Album type"
            >
              <option value="EP">EP</option>
              <option value="LP">LP</option>
              <option value="GreatestHits">Greatest Hits</option>
            </select>
          </div>

          <textarea
            value={albumDescription}
            onChange={(e) => {
              setAlbumDescription(e.target.value);
              if (saveState !== 'idle') {
                setSaveState('idle');
                setSaveMessage('');
              }
            }}
            placeholder="ALBUM DESCRIPTION"
            className="w-full h-20 p-3 mb-3 bg-black border border-[var(--app-panel-border)] text-xs uppercase tracking-wide placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />

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
                  <div className="h-full min-h-[330px] grid place-items-center text-xs uppercase tracking-[0.2em] text-slate-500 border border-dashed border-[var(--app-panel-border)] bg-black/30">
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

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              {builderTracks.length} tracks • {formatDuration(totalBuilderDurationMs)} • {albumType}
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={importAlbumInputRef}
                type="file"
                accept="application/json,.json"
                onChange={onImportAlbumJsonFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={clearDraftAlbum}
                disabled={builderTrackIds.length === 0}
                className="h-10 px-4 border border-red-400 text-xs font-bold uppercase tracking-[0.16em] text-red-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-950/40"
              >
                Clear Draft
              </button>
              <button
                type="button"
                onClick={() => importAlbumInputRef.current?.click()}
                className="h-10 px-4 border border-emerald-400 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-950/30"
              >
                Import Album JSON
              </button>
              <button
                type="button"
                onClick={exportCurrentDraftJson}
                disabled={builderTrackIds.length === 0}
                className="h-10 px-4 border border-emerald-300 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-300/10"
              >
                Export Draft JSON
              </button>
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
                {saveState === 'saving' ? 'Saving...' : editingAlbumId ? 'Update Album' : 'Save Album'}
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
      </DndContext>

      <div className="sr-only" aria-live="polite">
        {ariaLiveMessage}
      </div>
    </section>
  );
};

export default AlbumBuilderSection;
