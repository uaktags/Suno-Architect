import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { AppButton, AppCard, AppInput, AppSelect, AppTextarea, StatusMessage, cx } from '../ui/AppPrimitives';

type AlbumType = 'EP' | 'LP' | 'GreatestHits' | 'Single';

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

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatTimestamp = (ts: number | undefined): string => {
  if (!ts) return 'never';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

interface LibraryRowProps {
  track: BuilderTrack;
  isSelected: boolean;
  isAlreadyInBuilder: boolean;
  onToggleSelected: (id: string) => void;
  onAddToBuilder: (id: string) => void;
}

const LibraryRow: React.FC<LibraryRowProps> = ({ track, isSelected, isAlreadyInBuilder, onToggleSelected, onAddToBuilder }) => {
  return (
    <div className={cx(
      'flex items-center gap-3 p-2 rounded-lg border transition-colors',
      isSelected ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/10' : 'border-[var(--app-panel-border)]/50 hover:border-slate-500'
    )}>
      <button
        type="button"
        onClick={() => onToggleSelected(track.id)}
        className={cx(
          'w-5 h-5 rounded border flex items-center justify-center text-xs',
          isSelected ? 'bg-[var(--app-accent)] border-[var(--app-accent)]' : 'border-slate-500'
        )}
      >
        {isSelected && '✓'}
      </button>
      {track.imageUrl && (
        <img src={track.imageUrl} alt="" className="w-10 h-10 object-cover rounded" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        <p className="text-xs text-slate-400 flex gap-2">
          <span>{formatDuration(track.durationMs)}</span>
          {track.cachedLocally && <span className="text-emerald-400">cached</span>}
        </p>
      </div>
      {isAlreadyInBuilder ? (
        <span className="text-xs text-slate-500 px-2 py-1">in album</span>
      ) : (
        <AppButton size="sm" variant="primary" onClick={() => onAddToBuilder(track.id)}>
          +
        </AppButton>
      )}
    </div>
  );
};

interface BuilderRowProps {
  track: BuilderTrack;
  index: number;
  onRemove: (id: string) => void;
}

const BuilderRow: React.FC<BuilderRowProps> = ({ track, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `builder:${track.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        'flex items-center gap-3 p-3 rounded-lg border bg-[var(--app-panel)]/40 transition-colors',
        isDragging ? 'opacity-50 border-[var(--app-accent)]' : 'border-[var(--app-panel-border)]/50'
      )}
      {...attributes}
      {...listeners}
    >
      <span className="text-xs text-slate-500 w-6 text-center">☰</span>
      <span className="text-xs text-slate-500 w-6 text-center">{index + 1}</span>
      {track.imageUrl && <img src={track.imageUrl} alt="" className="w-10 h-10 object-cover rounded" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        <p className="text-xs text-slate-400">{formatDuration(track.durationMs)}</p>
      </div>
      <AppButton size="sm" variant="danger" onClick={() => onRemove(track.id)}>×</AppButton>
    </div>
  );
};

const AlbumBuilderSection: React.FC<AlbumBuilderSectionProps> = ({ history }) => {
  const [libraryTracks, setLibraryTracks] = useState<BuilderTrack[]>([]);
  const [builderTrackIds, setBuilderTrackIds] = useState<string[]>([]);
  const [selectedLibraryTrackIds, setSelectedLibraryTrackIds] = useState<string[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<OfflineAlbum[]>([]);
  const [selectedSavedAlbumId, setSelectedSavedAlbumId] = useState('');
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
  const [libraryScrollTop, setLibraryScrollTop] = useState(0);
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const importAlbumInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [tracks, albums] = await Promise.all([
          listAllTracks(),
          listAlbumsByUpdatedAtDesc()
        ]);
        if (!mounted) return;
        setLibraryTracks(tracks.map((t): BuilderTrack => ({
          id: t.id,
          title: t.title || 'Untitled',
          imageUrl: t.imageUrl || '',
          durationMs: t.metadata?.durationMs || 0,
          cachedLocally: t.cachedLocally || false,
          source: 'indexeddb'
        })));
        setSavedAlbums(albums);
      } catch (e) { console.error(e); }
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  const filteredLibraryTracks = useMemo(() => {
    let filtered = libraryTracks;
    if (libraryQuery) {
      const q = libraryQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
    }
    if (libraryAvailabilityFilter === 'cached') filtered = filtered.filter(t => t.cachedLocally);
    if (libraryAvailabilityFilter === 'remote') filtered = filtered.filter(t => !t.cachedLocally);
    return filtered.sort((a, b) => {
      if (librarySortMode === 'title-asc') return a.title.localeCompare(b.title);
      if (librarySortMode === 'title-desc') return b.title.localeCompare(a.title);
      if (librarySortMode === 'duration-asc') return a.durationMs - b.durationMs;
      return b.durationMs - a.durationMs;
    });
  }, [libraryTracks, libraryQuery, libraryAvailabilityFilter, librarySortMode]);

  const builderTrackIdSet = useMemo(() => new Set(builderTrackIds), [builderTrackIds]);
  const selectedLibraryTrackIdSet = useMemo(() => new Set(selectedLibraryTrackIds), [selectedLibraryTrackIds]);
  const builderTracks = useMemo(() => builderTrackIds.map(id => libraryTracks.find(t => t.id === id)).filter(Boolean) as BuilderTrack[], [builderTrackIds, libraryTracks]);
  const totalBuilderDurationMs = useMemo(() => builderTracks.reduce((sum, t) => sum + t.durationMs, 0), [builderTracks]);

  const trackById = useMemo(() => {
    const map = new Map<string, BuilderTrack>();
    libraryTracks.forEach(t => map.set(t.id, t));
    return map;
  }, [libraryTracks]);

  const selectedSavedAlbum = savedAlbums.find(a => a.id === selectedSavedAlbumId) || null;

  const addTrackToBuilder = (trackId: string) => {
    if (!builderTrackIdSet.has(trackId)) {
      setBuilderTrackIds(prev => [...prev, trackId]);
      setAriaLiveMessage(`Added ${trackById.get(trackId)?.title || 'track'} to album.`);
    }
  };

  const addSelectedTracksToBuilder = () => {
    const newTracks = selectedLibraryTrackIds.filter(id => !builderTrackIdSet.has(id));
    setBuilderTrackIds(prev => [...prev, ...newTracks]);
    setSelectedLibraryTrackIds([]);
    setAriaLiveMessage(`Added ${newTracks.length} tracks to album.`);
  };

  const removeTracksAlreadyInBuilderFromSelection = () => {
    setSelectedLibraryTrackIds(prev => prev.filter(id => !builderTrackIdSet.has(id)));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTrackId(null);
    if (!over) return;
    const activeId = String(active.id);
    if (!activeId.startsWith('builder:')) return;
    const oldIndex = builderTrackIds.indexOf(activeId.replace('builder:', ''));
    if (oldIndex === -1) return;
    if (over.id === 'droppable') {
      setBuilderTrackIds(prev => [...prev]);
    } else {
      const overId = String(over.id);
      if (overId.startsWith('builder:')) {
        const newIndex = builderTrackIds.indexOf(overId.replace('builder:', ''));
        if (oldIndex !== newIndex) {
          setBuilderTrackIds(prev => arrayMove(prev, oldIndex, newIndex));
          setAriaLiveMessage('Track reordered.');
        }
      }
    }
  };

  const clearDraftAlbum = () => {
    setBuilderTrackIds([]);
    setAlbumTitle('');
    setAlbumDescription('');
    setAlbumType('EP');
    setEditingAlbumId(null);
    setAriaLiveMessage('Draft cleared.');
  };

  const refreshSavedAlbums = async (force = false) => {
    setSavedAlbumsState('loading');
    try {
      const albums = await listAlbumsByUpdatedAtDesc();
      setSavedAlbums(albums);
      setSavedAlbumsState('idle');
    } catch (e: any) {
      setSavedAlbumsState('error');
      setSavedAlbumsMessage(e?.message || 'Failed to load albums');
    }
  };

  const loadSavedAlbumIntoDraft = (album: OfflineAlbum) => {
    setAlbumTitle(album.title || '');
    setAlbumDescription(album.description || '');
    setAlbumType(album.type as AlbumType);
    setBuilderTrackIds(album.trackIds || []);
    setEditingAlbumId(album.id);
    setAriaLiveMessage(`Loaded album: ${album.title}`);
  };

  const startNewDraftFromCurrent = () => {
    setEditingAlbumId(null);
    setAriaLiveMessage('Creating new draft from current.');
  };

  const duplicateSavedAlbumToNewDraft = async (album: OfflineAlbum) => {
    const newAlbum: OfflineAlbum = {
      id: crypto.randomUUID(),
      title: `${album.title} (Copy)`,
      description: album.description,
      type: album.type,
      trackIds: [...album.trackIds],
      coverArtUrl: album.coverArtUrl || '',
      raw: album.raw || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await upsertAlbums([newAlbum]);
    await refreshSavedAlbums();
    setSelectedSavedAlbumId(newAlbum.id);
    loadSavedAlbumIntoDraft(newAlbum);
    setAriaLiveMessage(`Duplicated album: ${newAlbum.title}`);
  };

  const [isDeleteConfirmArmed, setIsDeleteConfirmArmed] = useState(false);

  const onDeleteSelectedSavedAlbum = async () => {
    if (!selectedSavedAlbumId) return;
    if (!isDeleteConfirmArmed) {
      setIsDeleteConfirmArmed(true);
      return;
    }
    try {
      await deleteAlbumById(selectedSavedAlbumId);
      setSavedAlbums(prev => prev.filter(a => a.id !== selectedSavedAlbumId));
      setSelectedSavedAlbumId('');
      setIsDeleteConfirmArmed(false);
      setAriaLiveMessage('Album deleted.');
    } catch (e: any) {
      setSavedAlbumsMessage(e?.message || 'Failed to delete album');
    }
  };

  const exportAlbumJson = (album: OfflineAlbum) => {
    const data = JSON.stringify({ title: album.title, description: album.description, type: album.type, trackIds: album.trackIds }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${album.title || 'album'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportAlbumJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setAlbumTitle(data.title || '');
      setAlbumDescription(data.description || '');
      setAlbumType(data.type || 'EP');
      if (Array.isArray(data.trackIds)) {
        const validIds = data.trackIds.filter((id: string) => trackById.has(id));
        setBuilderTrackIds(validIds);
      }
    } catch { alert('Invalid JSON file'); }
    e.target.value = '';
  };

  const exportCurrentDraftJson = () => {
    const data = JSON.stringify({ title: albumTitle, description: albumDescription, type: albumType, trackIds: builderTrackIds }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${albumTitle || 'album'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSaveAlbum = async () => {
    if (!albumTitle.trim() || builderTrackIds.length === 0) return;
    setSaveState('saving');
    setSaveMessage('');
    try {
      const album: OfflineAlbum = {
        id: editingAlbumId || crypto.randomUUID(),
        title: albumTitle,
        description: albumDescription,
        type: albumType,
        trackIds: builderTrackIds,
        coverArtUrl: '',
        raw: null,
        createdAt: editingAlbumId ? savedAlbums.find(a => a.id === editingAlbumId)?.createdAt : Date.now(),
        updatedAt: Date.now()
      };
      await upsertAlbums([album]);
      await refreshSavedAlbums();
      setEditingAlbumId(album.id);
      setSelectedSavedAlbumId(album.id);
      setSaveState('saved');
      setSaveMessage('Album saved!');
      setAriaLiveMessage(`Album saved: ${album.title}`);
    } catch (e: any) {
      setSaveState('error');
      setSaveMessage(e?.message || 'Failed to save');
    }
  };

  const onDownloadAlbumZip = async () => {
    if (builderTrackIds.length === 0) return;
    setZipState('packing');
    setZipMessage('Packing ZIP...');
    try {
      await downloadTracksZipFromCache(albumTitle || 'album', builderTrackIds, 'album');
      setZipState('done');
      setZipMessage('ZIP ready!');
      setAriaLiveMessage('Album ZIP downloaded.');
    } catch (e: any) {
      setZipState('error');
      setZipMessage(e?.message || 'Failed to create ZIP');
    }
  };

  const totalLibraryHeight = filteredLibraryTracks.length * LIBRARY_ROW_HEIGHT;
  const topOffset = Math.floor(libraryScrollTop / LIBRARY_ROW_HEIGHT) * LIBRARY_ROW_HEIGHT;
  const visibleCount = Math.ceil(500 / LIBRARY_ROW_HEIGHT) + 2;
  const visibleLibraryTracks = filteredLibraryTracks.slice(topOffset / LIBRARY_ROW_HEIGHT, topOffset / LIBRARY_ROW_HEIGHT + visibleCount);

  const selectedFilteredCount = useMemo(() => 
    filteredLibraryTracks.reduce((count, track) => count + (selectedLibraryTrackIdSet.has(track.id) ? 1 : 0), 0),
    [filteredLibraryTracks, selectedLibraryTrackIdSet]
  );

  const builderDrop = useDroppable({ id: 'droppable' });

  const activeTrack = activeDragTrackId ? trackById.get(activeDragTrackId) : null;

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold text-white">Album Builder</h2>
        <p className="text-sm text-slate-400 mt-1">
          Build structured albums from local library tracks. Drag from the left pane into the right assembly zone.
        </p>
      </div>

      {savedAlbumsState === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {savedAlbumsMessage}
        </div>
      )}

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <AppCard className="lg:col-span-4 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Library</h3>
              <span className="text-xs text-slate-500">{filteredLibraryTracks.length}/{libraryTracks.length} tracks</span>
            </div>
            <div className="space-y-3 mb-3">
              <AppInput
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Search title or ID"
                aria-label="Search library tracks"
              />
              <div className="grid grid-cols-2 gap-2">
                <AppSelect value={libraryAvailabilityFilter} onChange={(e) => setLibraryAvailabilityFilter(e.target.value as LibraryAvailabilityFilter)} aria-label="Filter by availability">
                  <option value="all">All Sources</option>
                  <option value="cached">Cached Only</option>
                  <option value="remote">Remote Only</option>
                </AppSelect>
                <AppSelect value={librarySortMode} onChange={(e) => setLibrarySortMode(e.target.value as LibrarySortMode)} aria-label="Sort order">
                  <option value="title-asc">Title A-Z</option>
                  <option value="title-desc">Title Z-A</option>
                  <option value="duration-asc">Duration ↑</option>
                  <option value="duration-desc">Duration ↓</option>
                </AppSelect>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <AppButton size="sm" variant="secondary" onClick={() => setSelectedLibraryTrackIds(filteredLibraryTracks.map(t => t.id))} disabled={filteredLibraryTracks.length === 0}>
                Select All ({selectedFilteredCount}/{filteredLibraryTracks.length})
              </AppButton>
              <AppButton size="sm" variant="primary" onClick={addSelectedTracksToBuilder} disabled={selectedLibraryTrackIds.length === 0}>
                Add ({selectedLibraryTrackIds.length})
              </AppButton>
              <AppButton size="sm" variant="secondary" onClick={() => setSelectedLibraryTrackIds([])} disabled={selectedLibraryTrackIds.length === 0}>
                Clear
              </AppButton>
            </div>
            <div ref={libraryContainerRef} onScroll={(e) => setLibraryScrollTop(e.currentTarget.scrollTop)} className="h-[400px] overflow-y-auto rounded-lg border border-[var(--app-panel-border)]">
              <div style={{ height: totalLibraryHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${topOffset}px)` }} className="space-y-2 p-2">
                  {filteredLibraryTracks.length === 0 && (
                    <div className="h-24 grid place-items-center text-sm text-slate-500 border-2 border-dashed border-[var(--app-panel-border)] rounded-lg">
                      No tracks match filters
                    </div>
                  )}
                  {visibleLibraryTracks.map((track) => (
                    <LibraryRow key={track.id} track={track} isSelected={selectedLibraryTrackIdSet.has(track.id)} isAlreadyInBuilder={builderTrackIdSet.has(track.id)} onToggleSelected={(id) => setSelectedLibraryTrackIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} onAddToBuilder={addTrackToBuilder} />
                  ))}
                </div>
              </div>
            </div>
          </AppCard>

          <AppCard className="lg:col-span-8 p-4">
            <div className="border border-[var(--app-panel-border)] bg-[var(--app-panel)]/50 p-3 mb-3 rounded-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-white">Saved Albums {editingAlbumId ? `• Editing` : '• New Draft'}</h3>
                <div className="flex flex-wrap gap-2">
                  <AppButton size="sm" variant="secondary" onClick={() => refreshSavedAlbums(true)}>Refresh</AppButton>
                  <AppButton size="sm" variant="warning" onClick={startNewDraftFromCurrent} disabled={!editingAlbumId}>Save As New</AppButton>
                  <AppButton size="sm" variant="primary" onClick={() => selectedSavedAlbum && loadSavedAlbumIntoDraft(selectedSavedAlbum)} disabled={!selectedSavedAlbum}>Load</AppButton>
                  <AppButton size="sm" variant="danger" onClick={onDeleteSelectedSavedAlbum} disabled={!selectedSavedAlbum}>{isDeleteConfirmArmed ? 'Confirm' : 'Delete'}</AppButton>
                  <AppButton size="sm" variant="success" onClick={() => selectedSavedAlbum && exportAlbumJson(selectedSavedAlbum)} disabled={!selectedSavedAlbum}>Export</AppButton>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 mb-2">
                <AppSelect value={selectedSavedAlbumId} onChange={(e) => { setSelectedSavedAlbumId(e.target.value); setIsDeleteConfirmArmed(false); }} aria-label="Select saved album">
                  <option value="">Select saved album...</option>
                  {savedAlbums.map((album) => <option key={album.id} value={album.id}>{album.title || 'UNTITLED'} • {album.trackIds?.length || 0} tracks</option>)}
                </AppSelect>
              </div>
              <div className="min-h-5">
                {savedAlbumsState === 'loading' && <p className="text-xs text-slate-400">Loading...</p>}
                {isDeleteConfirmArmed && <p className="text-xs text-red-300">Delete armed. Press again to confirm.</p>}
                {selectedSavedAlbum && <p className="text-xs text-slate-400"><span className="text-white">{selectedSavedAlbum.title}</span> • {selectedSavedAlbum.trackIds?.length || 0} tracks</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <AppInput value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} placeholder="Album title" className="md:col-span-2" />
              <AppSelect value={albumType} onChange={(e) => setAlbumType(e.target.value as AlbumType)} aria-label="Album type">
                <option value="EP">EP</option>
                <option value="LP">LP</option>
                <option value="GreatestHits">Greatest Hits</option>
                <option value="Single">Single</option>
              </AppSelect>
            </div>

            <AppTextarea value={albumDescription} onChange={(e) => setAlbumDescription(e.target.value)} placeholder="Album description" className="h-20 mb-3" />

            <div ref={builderDrop.setNodeRef} className={cx('border-2 min-h-[250px] p-3 rounded-lg mb-3', builderDrop.isOver ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/10' : 'border-[var(--app-panel-border)]')}>
              <SortableContext items={builderTrackIds.map(id => `builder:${id}`)} strategy={verticalListSortingStrategy}>
                {builderTracks.length === 0 && (
                  <div className="h-[200px] grid place-items-center text-sm text-slate-500 border-2 border-dashed border-[var(--app-panel-border)] rounded-lg">
                    Drop tracks here to build album
                  </div>
                )}
                <div className="space-y-2">
                  {builderTracks.map((track, index) => (
                    <BuilderRow key={track.id} track={track} index={index} onRemove={(id) => { setBuilderTrackIds(prev => prev.filter(i => i !== id)); setAriaLiveMessage('Track removed.'); }} />
                  ))}
                </div>
              </SortableContext>
            </div>

            <DragOverlay>
              {activeTrack && (
                <div className="p-3 rounded-lg border border-[var(--app-accent)] bg-[var(--app-panel)] shadow-xl">
                  <p className="font-semibold text-white">{activeTrack.title}</p>
                </div>
              )}
            </DragOverlay>

            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm text-slate-400">{builderTracks.length} tracks • {formatDuration(totalBuilderDurationMs)} • {albumType}</p>
              <div className="flex items-center gap-2">
                <input ref={importAlbumInputRef} type="file" accept="application/json" onChange={onImportAlbumJsonFile} className="hidden" />
                <AppButton size="sm" variant="danger" onClick={clearDraftAlbum} disabled={builderTrackIds.length === 0}>Clear</AppButton>
                <AppButton size="sm" variant="secondary" onClick={() => importAlbumInputRef.current?.click()}>Import</AppButton>
                <AppButton size="sm" variant="secondary" onClick={exportCurrentDraftJson} disabled={builderTrackIds.length === 0}>Export</AppButton>
                <AppButton size="sm" variant="warning" onClick={onDownloadAlbumZip} disabled={builderTrackIds.length === 0 || zipState === 'packing'}>
                  {zipState === 'packing' ? 'Packing...' : 'Download ZIP'}
                </AppButton>
                <AppButton size="sm" variant="primary" onClick={onSaveAlbum} disabled={!albumTitle.trim() || builderTrackIds.length === 0 || saveState === 'saving'}>
                  {saveState === 'saving' ? 'Saving...' : editingAlbumId ? 'Update' : 'Save'}
                </AppButton>
              </div>
            </div>

            <div className="min-h-5">
              {saveMessage && <StatusMessage state={saveState === 'saved' ? 'done' : saveState === 'error' ? 'error' : 'idle'} message={saveMessage} />}
              {zipMessage && <StatusMessage state={zipState === 'done' ? 'done' : zipState === 'error' ? 'error' : 'idle'} message={zipMessage} />}
            </div>
          </AppCard>
        </div>
      </DndContext>

      <div className="sr-only" aria-live="polite">{ariaLiveMessage}</div>
    </div>
  );
};

export default AlbumBuilderSection;
