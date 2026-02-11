
import React, { useEffect, useMemo, useState } from 'react';
import { FileContext, AIProviderConfig, GenerationOptions, ReferenceSongInput, AlbumObjectivePreset } from '../../types';
import FileUploader from './FileUploader';
import TrackSelector from './TrackSelector';
import ApiKeyModal from '../ApiKeyModal';
import { ProviderSwitcher } from '../ProviderSwitcher';
import { getMaxTracksForProvider } from '../../services/providers/providerFactory';
import { extractSunoPlaylistId } from '../../services/sunoApi';

interface InputSectionProps {
  onGenerate: (prompt: string, files: FileContext[], numTracks: number, options?: GenerationOptions) => void;
  isLoading: boolean;
  apiKeyValid: boolean;
  providerConfig?: AIProviderConfig;
  onProviderConfigChange?: (config: AIProviderConfig) => void;
  onOpenProviderSettings?: () => void;
}

const InputSection: React.FC<InputSectionProps> = ({
  onGenerate,
  isLoading,
  apiKeyValid,
  providerConfig,
  onProviderConfigChange,
  onOpenProviderSettings
}) => {
  const [prompt, setPrompt] = useState('');
  const [numTracks, setNumTracks] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState<FileContext[]>([]);
  const [referenceIdsInput, setReferenceIdsInput] = useState('');
  const [referencePlaylistsInput, setReferencePlaylistsInput] = useState('');
  const [objectivePreset, setObjectivePreset] = useState<AlbumObjectivePreset>('standard');
  const [preserveMotifsInput, setPreserveMotifsInput] = useState('');
  const [avoidMotifsInput, setAvoidMotifsInput] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  const maxTracks = useMemo(
    () => getMaxTracksForProvider(providerConfig),
    [providerConfig]
  );

  const references = useMemo<ReferenceSongInput[]>(() => {
    const tokens = referenceIdsInput
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    const parsed: ReferenceSongInput[] = [];
    tokens.forEach((token) => {
      const match = token.match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[:@](\d{1,3}))?$/i
      );
      if (!match) return;
      const [, id, weightRaw] = match;
      const weight = weightRaw ? Math.min(100, Math.max(1, parseInt(weightRaw, 10))) : undefined;
      parsed.push({ id, weight });
    });

    return parsed;
  }, [referenceIdsInput]);

  const preserveMotifs = useMemo(
    () =>
      preserveMotifsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [preserveMotifsInput]
  );

  const avoidMotifs = useMemo(
    () =>
      avoidMotifsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [avoidMotifsInput]
  );

  const referencePlaylistIds = useMemo(
    () =>
      referencePlaylistsInput
        .split(/[\s,]+/)
        .map((token) => extractSunoPlaylistId(token))
        .filter((v): v is string => !!v),
    [referencePlaylistsInput]
  );

  useEffect(() => {
    if (numTracks > maxTracks) {
      setNumTracks(maxTracks);
    }
  }, [maxTracks, numTracks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKeyValid) {
        if (onOpenProviderSettings) {
          onOpenProviderSettings();
          return;
        }
        setShowKeyModal(true);
        return;
    }

    if ((prompt.trim() || selectedFiles.length > 0 || references.length > 0 || referencePlaylistIds.length > 0)) {
      const options: GenerationOptions = {
        references,
        referencePlaylistIds,
        preserveMotifs,
        avoidMotifs,
        objectivePreset,
      };
      onGenerate(prompt, selectedFiles, Math.min(numTracks, maxTracks), options);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      (Array.from(files) as File[]).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setSelectedFiles(prev => [...prev, {
              name: file.name,
              mimeType: file.type,
              data: event.target.result as string
            }]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isButtonDisabled =
    isLoading || (!prompt.trim() && selectedFiles.length === 0 && references.length === 0 && referencePlaylistIds.length === 0);

  return (
    <>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-xl relative">
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-4">
            Describe Your Album
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-slate-400 mb-2">
                Thematic Idea or Vibe
            </label>
            <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
                placeholder="E.g., A concept album about a city submerged under neon waves. Mix of synth-pop and heavy industrial."
                className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none text-base"
            />
            </div>

            <TrackSelector numTracks={numTracks} maxTracks={maxTracks} onChange={setNumTracks} />
            {numTracks > maxTracks && (
              <p className="text-xs text-yellow-300">
                Current provider/model supports up to {maxTracks} tracks in one generation.
              </p>
            )}

            {providerConfig && onProviderConfigChange && onOpenProviderSettings && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                    AI Provider
                </label>
                <ProviderSwitcher
                  providerConfig={providerConfig}
                  onConfigChange={onProviderConfigChange}
                  onOpenSettings={onOpenProviderSettings}
                />
              </div>
            )}

            <FileUploader 
                selectedFiles={selectedFiles} 
                onFileChange={handleFileChange} 
                onRemoveFile={removeFile} 
                isLoading={isLoading} 
            />

            <div>
              <label htmlFor="referenceSongIds" className="block text-sm font-medium text-slate-400 mb-2">
                Reference Existing Suno Songs (optional, supports weighting)
              </label>
              <textarea
                id="referenceSongIds"
                value={referenceIdsInput}
                onChange={(e) => setReferenceIdsInput(e.target.value)}
                disabled={isLoading}
                placeholder="UUID, UUID:70, UUID:30 (comma/space/newline separated)"
                className="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
              />
              <p className="text-xs text-slate-500 mt-2">
                Format: <code>songId</code> or <code>songId:weight</code>. Weights are 1-100 and bias influence per reference.
              </p>
            </div>

            <div>
              <label htmlFor="referencePlaylists" className="block text-sm font-medium text-slate-400 mb-2">
                Reference Suno Playlists (optional)
              </label>
              <textarea
                id="referencePlaylists"
                value={referencePlaylistsInput}
                onChange={(e) => setReferencePlaylistsInput(e.target.value)}
                disabled={isLoading}
                placeholder="Paste playlist URL(s) or playlist ID(s), comma/space/newline separated"
                className="w-full h-20 bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Album Objective</label>
                <select
                  value={objectivePreset}
                  onChange={(e) => setObjectivePreset(e.target.value as AlbumObjectivePreset)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                >
                  <option value="standard">Standard Album Generation</option>
                  <option value="append">Append New Tracks to Referenced Album</option>
                </select>
                {objectivePreset === 'append' && (
                  <p className="text-xs text-slate-500 mt-2">
                    Generates exactly the selected number of new tracks as continuation material after your references.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="preserveMotifs" className="block text-sm font-medium text-slate-400 mb-2">
                  Preserve Motifs (optional)
                </label>
                <input
                  id="preserveMotifs"
                  type="text"
                  value={preserveMotifsInput}
                  onChange={(e) => setPreserveMotifsInput(e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g. neon coast, whispered pre-hook, 128 BPM pulse"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label htmlFor="avoidMotifs" className="block text-sm font-medium text-slate-400 mb-2">
                  Avoid Motifs (optional)
                </label>
                <input
                  id="avoidMotifs"
                  type="text"
                  value={avoidMotifsInput}
                  onChange={(e) => setAvoidMotifsInput(e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g. trap hi-hat rolls, choir stacks, guitar solos"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="relative group">
                <button
                type="submit"
                disabled={isButtonDisabled}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-300 flex items-center justify-center space-x-2
                    ${
                    isButtonDisabled
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-70'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:shadow-purple-500/25'
                    }`}
                >
                {isLoading ? (
                    <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Constructing {numTracks > 1 ? `Album (${numTracks} Tracks)` : 'Prompt'}...</span>
                    </>
                ) : (
                    <>
                    <span>{numTracks > 1 ? `Generate Album (${numTracks} Tracks)` : 'Generate Prompt'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    </>
                )}
                </button>
            </div>
        </form>
        </div>
        
        <ApiKeyModal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} />
    </>
  );
};

export default InputSection;
