import React, { useState } from 'react';
import { VISUALIZER_FONTS } from '../../constants';
import { Qt6Style } from '../../types';

interface VisualizerSettingsProps {
    savedPresets: Array<{ id: string; name: string; createdAt: string }>;
    onSavePreset: (name: string) => void;
    onApplySavedPreset: (id: string) => void;
    onDeleteSavedPreset: (id: string) => void;
    templatePreset: 'classic' | 'clean-lyrics' | 'corner-pulse' | 'cinematic-bars';
    onTemplateChange: (val: 'classic' | 'clean-lyrics' | 'corner-pulse' | 'cinematic-bars') => void;
    fontFamily: string;
    setFontFamily: (val: string) => void;
    activeColor: string;
    setActiveColor: (val: string) => void;
    inactiveColor: string;
    setInactiveColor: (val: string) => void;
    smoothingFactor: number;
    setSmoothingFactor: (val: number) => void;
    verticalOffset: number;
    setVerticalOffset: (val: number) => void;
    inactiveOpacity: number;
    setInactiveOpacity: (val: number) => void;
    mainVisualizerEnabled: boolean;
    showTitle: boolean;
    setShowTitle: (val: boolean) => void;
    logoPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    setLogoPosition: (val: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left') => void;
    logoScale: number;
    setLogoScale: (val: number) => void;
    logoOpacity: number;
    setLogoOpacity: (val: number) => void;
    logoPulseEnabled: boolean;
    setLogoPulseEnabled: (val: boolean) => void;
    logoPulseStyle: 'expanding-circle' | 'radial-bars';
    setLogoPulseStyle: (val: 'expanding-circle' | 'radial-bars') => void;
    logoPulseGap: number;
    setLogoPulseGap: (val: number) => void;
    logoPulseScale: number;
    setLogoPulseScale: (val: number) => void;
    logoPulseSensitivity: number;
    setLogoPulseSensitivity: (val: number) => void;
    qt6Style: Qt6Style;
    setQt6Style: (val: Qt6Style) => void;
    qt6BarCount: number;
    setQt6BarCount: (val: number) => void;
    qt6Sensitivity: number;
    setQt6Sensitivity: (val: number) => void;
    videoBitrate: number;
    setVideoBitrate: (val: number) => void;
    videoBitrateMode: 'constant' | 'variable';
    setVideoBitrateMode: (val: 'constant' | 'variable') => void;
    fps: number;
    setFps: (val: number) => void;
    outputAspectTarget: 'landscape' | 'portrait';
    setOutputAspectTarget: (val: 'landscape' | 'portrait') => void;
    preRollEnabled: boolean;
    setPreRollEnabled: (val: boolean) => void;
    preRollType: 'text' | 'qr';
    setPreRollType: (val: 'text' | 'qr') => void;
    preRollText: string;
    setPreRollText: (val: string) => void;
    preRollSeconds: number;
    setPreRollSeconds: (val: number) => void;
    postRollEnabled: boolean;
    setPostRollEnabled: (val: boolean) => void;
    postRollType: 'text' | 'qr';
    setPostRollType: (val: 'text' | 'qr') => void;
    postRollText: string;
    setPostRollText: (val: string) => void;
    postRollSeconds: number;
    setPostRollSeconds: (val: number) => void;
    onReset: () => void;
}

const VisualizerSettings: React.FC<VisualizerSettingsProps> = ({
    savedPresets, onSavePreset, onApplySavedPreset, onDeleteSavedPreset,
    templatePreset, onTemplateChange,
    fontFamily, setFontFamily, activeColor, setActiveColor, inactiveColor, setInactiveColor,
    smoothingFactor, setSmoothingFactor, verticalOffset, setVerticalOffset, inactiveOpacity, setInactiveOpacity,
    mainVisualizerEnabled, showTitle, setShowTitle, logoPosition, setLogoPosition, logoScale, setLogoScale, logoOpacity, setLogoOpacity,
    logoPulseEnabled, setLogoPulseEnabled, logoPulseStyle, setLogoPulseStyle, logoPulseGap, setLogoPulseGap, logoPulseScale, setLogoPulseScale, logoPulseSensitivity, setLogoPulseSensitivity,
    qt6Style, setQt6Style, qt6BarCount, setQt6BarCount, qt6Sensitivity, setQt6Sensitivity, 
    videoBitrate, setVideoBitrate, videoBitrateMode, setVideoBitrateMode,
    fps, setFps,
    outputAspectTarget, setOutputAspectTarget,
    preRollEnabled, setPreRollEnabled, preRollType, setPreRollType, preRollText, setPreRollText, preRollSeconds, setPreRollSeconds,
    postRollEnabled, setPostRollEnabled, postRollType, setPostRollType, postRollText, setPostRollText, postRollSeconds, setPostRollSeconds,
    onReset
}) => {
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedSavedPresetId, setSelectedSavedPresetId] = useState('');
  const logoVisualizerMode: 'off' | 'expanding-circle' | 'radial-bars' =
    logoPulseEnabled ? logoPulseStyle : 'off';

  const handleSavePreset = () => {
    const clean = newPresetName.trim();
    if (!clean) return;
    onSavePreset(clean);
    setNewPresetName('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visual & Export Settings</h3>
            <button onClick={onReset} className="text-xs text-purple-400 hover:text-purple-300">Reset to Default</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 md:col-span-4 border border-slate-800 bg-slate-950/40 rounded-lg p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Preset name"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100"
                    />
                    <button onClick={handleSavePreset} className="rounded px-2 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
                        Save Current Settings
                    </button>
                    <button onClick={() => selectedSavedPresetId && onApplySavedPreset(selectedSavedPresetId)} disabled={!selectedSavedPresetId} className="rounded px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold">
                        Load Saved Preset
                    </button>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                        value={selectedSavedPresetId}
                        onChange={(e) => setSelectedSavedPresetId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
                    >
                        <option value="">Select saved preset...</option>
                        {savedPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => {
                            if (!selectedSavedPresetId) return;
                            onDeleteSavedPreset(selectedSavedPresetId);
                            setSelectedSavedPresetId('');
                        }}
                        disabled={!selectedSavedPresetId}
                        className="rounded px-2 py-1.5 text-xs bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white font-semibold"
                    >
                        Delete Selected Preset
                    </button>
                    <div className="text-[10px] text-slate-500 flex items-center justify-start md:justify-end">
                        {savedPresets.length} saved preset{savedPresets.length === 1 ? '' : 's'}
                    </div>
                </div>
            </div>
            <div className="col-span-2 md:col-span-2">
                <label className="text-[10px] text-slate-500 block mb-1">Template Preset</label>
                <select
                    value={templatePreset}
                    onChange={(e) => onTemplateChange(e.target.value as 'classic' | 'clean-lyrics' | 'corner-pulse' | 'cinematic-bars')}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                    <option value="classic">Classic Cover Lyrics</option>
                    <option value="clean-lyrics">Clean Lyric Frame</option>
                    <option value="corner-pulse">Corner Pulse Logo</option>
                    <option value="cinematic-bars">Cinematic Bars</option>
                </select>
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-slate-500 block mb-1">Font Family</label>
                <select 
                value={fontFamily} 
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                    {VISUALIZER_FONTS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Active Color</label>
                <div className="flex items-center gap-2">
                    <input 
                    type="color" 
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0" 
                    />
                    <span className="text-xs font-mono text-slate-400">{activeColor}</span>
                </div>
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Inactive Color</label>
                <div className="flex items-center gap-2">
                    <input 
                    type="color" 
                    value={inactiveColor}
                    onChange={(e) => setInactiveColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0" 
                    />
                    <span className="text-xs font-mono text-slate-400">{inactiveColor}</span>
                </div>
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-slate-500 block mb-1">Scroll Smoothing</label>
                <input 
                type="range" 
                min="0.01" 
                max="0.5" 
                step="0.01" 
                value={smoothingFactor} 
                onChange={(e) => setSmoothingFactor(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Smooth</span>
                    <span>Instant</span>
                </div>
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-slate-500 block mb-1">Vertical Position</label>
                <input 
                type="range" 
                min="-0.4" 
                max="0.4" 
                step="0.01" 
                value={verticalOffset} 
                onChange={(e) => setVerticalOffset(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Top</span>
                    <span>Bottom</span>
                </div>
            </div>
            
            {/* Export Settings */}
            <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-slate-500 block mb-1">Video Bitrate (bps)</label>
                <input 
                    type="number" 
                    value={videoBitrate}
                    onChange={(e) => setVideoBitrate(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                    step={100000}
                />
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-slate-500 block mb-1">Bitrate Mode</label>
                <select 
                    value={videoBitrateMode}
                    onChange={(e) => setVideoBitrateMode(e.target.value as 'constant' | 'variable')}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                    <option value="variable">Variable (VBR)</option>
                    <option value="constant">Constant (CBR)</option>
                </select>
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">FPS</label>
                <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                </select>
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-slate-500 block mb-1">Render Target</label>
                <select
                    value={outputAspectTarget}
                    onChange={(e) => setOutputAspectTarget(e.target.value as 'landscape' | 'portrait')}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                    <option value="landscape">16:9 Output (1920x1080)</option>
                    <option value="portrait">9:16 Output (1080x1920)</option>
                </select>
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Show Song Title</label>
                <button
                    onClick={() => setShowTitle(!showTitle)}
                    className={`w-full rounded p-1.5 text-xs border ${showTitle ? 'bg-cyan-600/20 border-cyan-500 text-cyan-200' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                >
                    {showTitle ? 'On' : 'Off'}
                </button>
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] text-slate-500 block mb-1">Logo Position</label>
                <select
                    value={logoPosition}
                    onChange={(e) => setLogoPosition(e.target.value as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left')}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                </select>
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Logo Size</label>
                <input
                    type="range"
                    min="0.08"
                    max="0.45"
                    step="0.01"
                    value={logoScale}
                    onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Logo Opacity</label>
                <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    value={logoOpacity}
                    onChange={(e) => setLogoOpacity(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Logo Visualizer</label>
                <select
                    value={logoVisualizerMode}
                    onChange={(e) => {
                        const value = e.target.value as 'off' | 'expanding-circle' | 'radial-bars';
                        if (value === 'off') {
                            setLogoPulseEnabled(false);
                            return;
                        }
                        setLogoPulseEnabled(true);
                        setLogoPulseStyle(value);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                    <option value="off">Off</option>
                    <option value="expanding-circle">Expanding Circle</option>
                    <option value="radial-bars">Radial Bars</option>
                </select>
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Pulse Size</label>
                <input
                    type="range"
                    min="0.35"
                    max="2.8"
                    step="0.05"
                    value={logoPulseScale}
                    onChange={(e) => setLogoPulseScale(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={!logoPulseEnabled}
                />
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Pulse Gap</label>
                <input
                    type="range"
                    min="-40"
                    max="80"
                    step="1"
                    value={logoPulseGap}
                    onChange={(e) => setLogoPulseGap(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={!logoPulseEnabled}
                />
            </div>
            <div>
                <label className="text-[10px] text-slate-500 block mb-1">Pulse Sensitivity</label>
                <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={logoPulseSensitivity}
                    onChange={(e) => setLogoPulseSensitivity(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={!logoPulseEnabled}
                />
            </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Custom Message Cards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-700 bg-slate-950/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wide">Pre-Roll</label>
                        <button
                            onClick={() => setPreRollEnabled(!preRollEnabled)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${preRollEnabled ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                        >
                            {preRollEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>
                    <select
                        value={preRollType}
                        onChange={(e) => setPreRollType(e.target.value as 'text' | 'qr')}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                        disabled={!preRollEnabled}
                    >
                        <option value="text">Text Message</option>
                        <option value="qr">QR Code</option>
                    </select>
                    <textarea
                        value={preRollText}
                        onChange={(e) => setPreRollText(e.target.value)}
                        placeholder={preRollType === 'qr' ? 'https://your-link.example' : 'Thank you for supporting my work'}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 min-h-20"
                        disabled={!preRollEnabled}
                    />
                    <input
                        type="number"
                        min={1}
                        max={15}
                        value={preRollSeconds}
                        onChange={(e) => setPreRollSeconds(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
                        disabled={!preRollEnabled}
                    />
                </div>

                <div className="border border-slate-700 bg-slate-950/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wide">Post-Roll</label>
                        <button
                            onClick={() => setPostRollEnabled(!postRollEnabled)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${postRollEnabled ? 'bg-purple-500/20 border-purple-500 text-purple-200' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                        >
                            {postRollEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>
                    <select
                        value={postRollType}
                        onChange={(e) => setPostRollType(e.target.value as 'text' | 'qr')}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                        disabled={!postRollEnabled}
                    >
                        <option value="text">Text Message</option>
                        <option value="qr">QR Code</option>
                    </select>
                    <textarea
                        value={postRollText}
                        onChange={(e) => setPostRollText(e.target.value)}
                        placeholder={postRollType === 'qr' ? 'https://your-link.example' : 'Tripped Out Tim'}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 min-h-20"
                        disabled={!postRollEnabled}
                    />
                    <input
                        type="number"
                        min={1}
                        max={15}
                        value={postRollSeconds}
                        onChange={(e) => setPostRollSeconds(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
                        disabled={!postRollEnabled}
                    />
                </div>
            </div>
        </div>

        {/* Qt6 Specific Controls */}
        {mainVisualizerEnabled && (
            <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in">
                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">Qt6 Visualizer Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Type</label>
                        <select 
                        value={qt6Style}
                        onChange={(e) => setQt6Style(e.target.value as Qt6Style)}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white focus:ring-1 focus:ring-purple-500"
                        >
                            <option value="wave">Oscilloscope (Wave)</option>
                            <option value="bars">Stylish Bars</option>
                            <option value="circle">Expanding Circle</option>
                            <option value="circular-wave">Circular Wave</option>
                        </select>
                    </div>
                    {qt6Style === 'bars' && (
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Bar Count</label>
                            <select 
                            value={qt6BarCount}
                            onChange={(e) => setQt6BarCount(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                            >
                                <option value="32">32 Bars (Chunky)</option>
                                <option value="64">64 Bars (Standard)</option>
                                <option value="128">128 Bars (Detailed)</option>
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Sensitivity (Gain)</label>
                        <input 
                        type="range" 
                        min="0.5" 
                        max="3.0" 
                        step="0.1" 
                        value={qt6Sensitivity}
                        onChange={(e) => setQt6Sensitivity(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default VisualizerSettings;
