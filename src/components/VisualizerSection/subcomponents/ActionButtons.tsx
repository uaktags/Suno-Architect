import React from 'react';
import { AUDIO_BITRATES } from '../../../constants';

interface ActionButtonsProps {
  audioBitrate: number;
  setAudioBitrate: (val: number) => void;
  fps: number;
  setFps: (val: number) => void;
  isRendering: boolean;
  renderProgress: number;
  renderSpeed: number;
  onStartRender: () => void;
  isPreparing: boolean;
  hasAlignment: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  audioBitrate,
  setAudioBitrate,
  fps,
  setFps,
  isRendering,
  renderProgress,
  renderSpeed,
  onStartRender,
  isPreparing,
  hasAlignment
}) => {
  const localExportRemoved = true;
  const isDisabled = localExportRemoved || isPreparing || !hasAlignment || isRendering;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 block mb-1">Audio Quality</label>
            <select 
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(Number(e.target.value))}
                className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded text-xs text-white p-1.5 focus:ring-1 focus:ring-[var(--app-accent)]/50"
            >
                {AUDIO_BITRATES.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                ))}
            </select>
          </div>
          <div className="w-24">
            <label className="text-[10px] text-slate-500 block mb-1">Frame Rate</label>
            <select 
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded text-xs text-white p-1.5 focus:ring-1 focus:ring-[var(--app-accent)]/50"
            >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
            </select>
          </div>
      </div>
      <button
        onClick={localExportRemoved ? undefined : onStartRender}
        disabled={isDisabled}
        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2
        ${isRendering 
            ? 'bg-purple-800 text-white cursor-wait' 
            : isDisabled
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-[var(--app-accent)] hover:bg-[var(--app-accent)] text-white'
        }`}
      >
          {isRendering ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></span>
                Rendering {Math.round(renderProgress)}% ({renderSpeed.toFixed(2)}x)
              </>
          ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                </svg>
                Local Export Removed
              </>
          )}
      </button>
      {isRendering && (
          <div className="w-full bg-[var(--app-panel)] rounded-full h-2 overflow-hidden mt-2">
              <div className="bg-[var(--app-accent)] h-full transition-all duration-300" style={{ width: `${renderProgress}%` }}></div>
          </div>
      )}
      {!isRendering && (
          <p className="text-xs text-center text-slate-400">
              Local/offline browser rendering was removed to keep the app live-first and avoid bundling FFmpeg WASM. <br/>
              <span className="text-[var(--app-accent)]">Use:</span> the Publishing Workflow panel below.
          </p>
      )}
    </div>
  );
};

export default ActionButtons;
