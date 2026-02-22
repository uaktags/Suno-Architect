import React from 'react';
import { SunoClip } from '../../types';
import { AppButton, AppCard, AppInput, AppSelect } from '../ui/AppPrimitives';

interface VisualizerHeaderProps {
  history: SunoClip[];
  selectedClipId: string;
  setSelectedClipId: (id: string) => void;
  manualId: string;
  setManualId: (id: string) => void;
  onManualLoad: () => void;
}

const VisualizerHeader: React.FC<VisualizerHeaderProps> = ({ 
    history, selectedClipId, setSelectedClipId, manualId, setManualId, onManualLoad 
}) => {
  return (
    <AppCard className="p-6 backdrop-blur-sm border-[var(--app-panel-border)]/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
            <h2 className="text-2xl font-bold text-white mb-1">Lyric Video Visualizer</h2>
            <p className="text-sm text-slate-400">Build lyric visuals live and publish through the connected workflow (Suno sync can be used offline).</p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                <AppSelect
                value={selectedClipId}
                onChange={(e) => setSelectedClipId(e.target.value)}
                className="block w-full md:w-64 text-slate-300"
                >
                    <option value="">Select from History...</option>
                    {history.filter(c => !c.id.startsWith('draft_')).map(c => (
                        <option key={c.id} value={c.id}>{c.title || c.id}</option>
                    ))}
                </AppSelect>
            </div>
        </div>
        
        <div className="flex gap-2 items-center pt-4 border-t border-[var(--app-panel-border)]/50">
        <AppInput
            type="text" 
            placeholder="Or paste Suno ID / UUID manually..." 
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            className="flex-1"
        />
        <AppButton
            variant="secondary"
            onClick={onManualLoad}
            className="text-sm px-4 py-2"
        >
            Load ID
        </AppButton>
        </div>
    </AppCard>
  );
};

export default VisualizerHeader;
