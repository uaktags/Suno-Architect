import React from 'react';
import { AppButton, AppCard, AppTextarea } from '../../ui/AppPrimitives';

interface MetadataCardProps {
  lyricSource: string;
  setLyricSource: (val: string) => void;
  onApplyLyrics: () => void;
  applyStatus: 'idle' | 'applied';
  hasAlignment: boolean;
}

const MetadataCard: React.FC<MetadataCardProps> = ({ 
  lyricSource, 
  setLyricSource, 
  onApplyLyrics, 
  applyStatus, 
  hasAlignment 
}) => {
  return (
    <AppCard className="rounded-xl overflow-hidden shadow-lg p-0">
      <div className="bg-[var(--app-panel)] px-4 py-3 border-b border-[var(--app-panel-border)] flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lyrics & Structure Source</h3>
          <AppButton
              variant="primary"
              onClick={onApplyLyrics}
              disabled={!hasAlignment}
              className={`text-xs px-2 py-1 disabled:opacity-50
                  ${applyStatus === 'applied' 
                      ? 'bg-green-600 border-green-500 text-white' 
                      : 'bg-[var(--app-accent)] hover:bg-[var(--app-accent)] border-purple-500 text-white'}`}
              title="Update lines based on this text"
          >
              {applyStatus === 'applied' ? 'Applied!' : 'Apply Structure'}
          </AppButton>
      </div>
      <div className="p-2">
            <AppTextarea
              value={lyricSource}
              onChange={(e) => setLyricSource(e.target.value)}
              className="w-full h-40 bg-slate-950 text-xs font-mono text-slate-300 placeholder-slate-600 custom-scrollbar resize-none leading-relaxed"
              placeholder="Paste lyrics here. Use newlines to determine how lines are grouped in the visualizer."
            />
            <p className="text-[10px] text-slate-500 mt-2 px-1">
              <strong>Tip:</strong> This text determines line breaks. Aligning is fuzzy; edit text to fix grouping issues.
            </p>
      </div>
    </AppCard>
  );
};

export default MetadataCard;
