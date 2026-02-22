import React, { useState, useEffect } from 'react';
import { AIProviderConfig, AppLayout, PromptSettings } from '../types';
import { ApiKeyStorageMode } from '../utils/apiKeyStorage';
import { APP_THEMES, APP_LAYOUTS } from '../constants';
import { ProviderSettingsModal } from './ProviderSettingsModal';
import SunoSettingsModal from './SunoSettingsModal';

type AppTheme = 'midnight' | 'neon-synth' | 'dawn-studio' | 'forest-night';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Appearance
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;
  appLayout: AppLayout;
  setAppLayout: (layout: AppLayout) => void;
  // Provider
  providerConfig: AIProviderConfig;
  initialStorageMode: ApiKeyStorageMode;
  onSaveProvider: (config: AIProviderConfig, storageMode: ApiKeyStorageMode) => Promise<void> | void;
  // Suno
  sunoCookie: string;
  sunoModel: string;
  promptSettings: PromptSettings;
  sunoCredits: number | null;
  onSaveSuno: (cookie: string, model: string, promptSettings: PromptSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  appTheme,
  setAppTheme,
  appLayout,
  setAppLayout,
  providerConfig,
  initialStorageMode,
  onSaveProvider,
  sunoCookie,
  sunoModel,
  promptSettings,
  sunoCredits,
  onSaveSuno
}) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'provider' | 'suno'>('appearance');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-[var(--app-panel-border)] rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex-shrink-0 border-b border-[var(--app-panel-border)] bg-[var(--app-panel)] p-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="bg-[var(--app-panel)] p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-pink-400">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
            Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Side Navigation */}
          <div className="w-48 bg-slate-950/50 border-r border-[var(--app-panel-border)] flex flex-col overflow-y-auto">
            <button
              onClick={() => setActiveTab('appearance')}
              className={`px-4 py-4 text-sm font-bold transition-colors text-left border-l-2 ${activeTab === 'appearance' ? 'text-[var(--app-accent)] border-[var(--app-accent)] bg-slate-900/80' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
            >
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('provider')}
              className={`px-4 py-4 text-sm font-bold transition-colors text-left border-l-2 ${activeTab === 'provider' ? 'text-[var(--app-accent)] border-[var(--app-accent)] bg-slate-900/80' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
            >
              AI Provider
            </button>
            <button
              onClick={() => setActiveTab('suno')}
              className={`px-4 py-4 text-sm font-bold transition-colors text-left border-l-2 ${activeTab === 'suno' ? 'text-[var(--app-accent)] border-[var(--app-accent)] bg-slate-900/80' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
            >
              Suno Integration
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {activeTab === 'appearance' && (
              <div className="p-6 max-w-2xl">
                <h3 className="text-lg font-bold text-white mb-6">Appearance</h3>
                
                <div className="space-y-6">
                  <div className="bg-[var(--app-panel)] p-5 rounded-xl border border-[var(--app-panel-border)]">
                    <label htmlFor="theme-picker-modal" className="block text-sm font-semibold text-slate-300 mb-3">
                      Theme
                    </label>
                    <select
                      id="theme-picker-modal"
                      value={appTheme}
                      onChange={(e) => setAppTheme(e.target.value as AppTheme)}
                      className="w-full h-11 rounded-lg border px-3 text-sm font-medium text-slate-100 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
                      style={{ borderColor: 'var(--app-panel-border)' }}
                    >
                      {APP_THEMES.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-2">Changes the overall color palette of the studio.</p>
                  </div>

                  <div className="bg-[var(--app-panel)] p-5 rounded-xl border border-[var(--app-panel-border)]">
                    <label htmlFor="layout-picker-modal" className="block text-sm font-semibold text-slate-300 mb-3">
                      Layout
                    </label>
                    <select
                      id="layout-picker-modal"
                      value={appLayout}
                      onChange={(e) => setAppLayout(e.target.value as AppLayout)}
                      className="w-full h-11 rounded-lg border px-3 text-sm font-medium text-slate-100 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
                      style={{ borderColor: 'var(--app-panel-border)' }}
                    >
                      {APP_LAYOUTS.map((layout) => (
                        <option key={layout.id} value={layout.id}>
                          {layout.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-2">Choose between a top navigation bar, side sidebar, or dense studio view.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'provider' && (
              <div className="p-0">
                {/* Embed the ProviderSettingsModal content directly, hiding its outer shell */}
                <ProviderSettingsModal 
                  isOpen={true} 
                  onClose={onClose} 
                  onSave={onSaveProvider} 
                  initialConfig={providerConfig} 
                  initialStorageMode={initialStorageMode}
                  isEmbedded={true}
                />
              </div>
            )}

            {activeTab === 'suno' && (
              <div className="p-0">
                {/* Embed the SunoSettingsModal content directly, hiding its outer shell */}
                <SunoSettingsModal 
                  isOpen={true} 
                  onClose={onClose} 
                  onSave={onSaveSuno} 
                  initialCookie={sunoCookie}
                  initialModel={sunoModel}
                  initialPromptSettings={promptSettings}
                  currentCredits={sunoCredits}
                  isEmbedded={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
