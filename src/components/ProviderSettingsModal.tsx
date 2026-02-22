import React, { useState, useEffect, useRef } from 'react';
import { AIProviderConfig, ProviderType } from '../types';
import { createProvider, getDefaultModelForProvider } from '../services/providers/providerFactory';
import { ApiKeyStorageMode } from '../utils/apiKeyStorage';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AIProviderConfig, storageMode: ApiKeyStorageMode) => Promise<void> | void;
  initialConfig: AIProviderConfig;
  initialStorageMode: ApiKeyStorageMode;
  isEmbedded?: boolean;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  initialStorageMode,
  isEmbedded = false,
}) => {
  const [config, setConfig] = useState<AIProviderConfig>(initialConfig);
  const [storageMode, setStorageMode] = useState<ApiKeyStorageMode>(initialStorageMode);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modelSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(initialConfig);
      setStorageMode(initialStorageMode);
      setAvailableModels([]);
      setModelFetchError(null);
      setIsModelDropdownOpen(false);
      setModelSearchQuery('');
      setSaveError(null);
    }
  }, [isOpen, initialConfig, initialStorageMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
      }
    };

    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  useEffect(() => {
    if (isModelDropdownOpen && modelSearchInputRef.current) {
      setTimeout(() => {
        modelSearchInputRef.current?.focus();
      }, 10);
    } else if (!isModelDropdownOpen) {
      setModelSearchQuery('');
    }
  }, [isModelDropdownOpen]);

  const handleFetchModels = async () => {
    if (!config.apiKey && config.type !== 'openapi') {
      setModelFetchError('API key is required to fetch models');
      return;
    }

    setIsFetchingModels(true);
    setModelFetchError(null);

    try {
      const provider = createProvider(config);
      const models = await provider.getAvailableModels();
      setAvailableModels(models);
      if (models.length === 0) {
        setModelFetchError('No models found. Check your API key and endpoint configuration.');
      }
    } catch (error: any) {
      console.error('Failed to fetch models:', error);
      setModelFetchError(error.message || 'Failed to fetch models. Check your configuration.');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query) return true;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerText.includes(lowerQuery)) return true;
    
    let queryIndex = 0;
    for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === lowerQuery.length;
  };

  const filteredModels = availableModels.filter(model => 
    fuzzyMatch(model, modelSearchQuery)
  );

  const handleModelSelect = (model: string) => {
    setConfig({ ...config, model });
    setIsModelDropdownOpen(false);
    setModelSearchQuery('');
  };

  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);

    const configToSave = {
      ...config,
      baseUrl: config.baseUrl ? config.baseUrl.replace(/\/+$/, '') : config.baseUrl,
    };

    try {
      await onSave(configToSave, storageMode);
      onClose();
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to save provider settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className={`${isEmbedded ? 'h-full flex flex-col' : 'bg-[var(--app-panel)] rounded-xl p-6 max-w-2xl w-full border border-[var(--app-panel-border)] shadow-2xl max-h-[90vh] overflow-y-auto'}`}>
      {!isEmbedded && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">AI Provider Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      
      {isEmbedded && <h3 className="text-lg font-bold text-white mb-6 p-6 pb-0">AI Provider Settings</h3>}

      <div className={`space-y-4 ${isEmbedded ? 'p-6 flex-grow overflow-y-auto custom-scrollbar' : ''}`}>
        <div>
          <label className="block text-sm font-semibold text-slate-400 mb-2">
            Provider Type
            </label>
            <select
              value={config.type}
              onChange={(e) => {
                const newType = e.target.value as ProviderType;
                setConfig({ 
                  ...config, 
                  type: newType,
                  model: getDefaultModelForProvider(newType),
                  baseUrl: newType === 'openapi' ? config.baseUrl : undefined,
                  authHeader: newType === 'openapi' ? (config.authHeader || 'Authorization') : undefined,
                  authPrefix: newType === 'openapi' ? (config.authPrefix || 'Bearer ') : undefined,
                });
                setAvailableModels([]);
                setModelFetchError(null);
              }}
              className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openapi">Custom OpenAPI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">
              API Key {config.type === 'openapi' && '(Optional if using custom auth)'}
            </label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
              placeholder="Enter API key"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">
              API Key Storage
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStorageMode('client')}
                className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                  storageMode === 'client'
                    ? 'bg-[var(--app-accent)]/20 border-purple-500 text-purple-200'
                    : 'bg-slate-900 border-[var(--app-panel-border)] text-slate-300 hover:border-slate-600'
                }`}
              >
                Client only
              </button>
              <button
                type="button"
                onClick={() => setStorageMode('server')}
                className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                  storageMode === 'server'
                    ? 'bg-[var(--app-accent)]/20 border-purple-500 text-purple-200'
                    : 'bg-slate-900 border-[var(--app-panel-border)] text-slate-300 hover:border-slate-600'
                }`}
              >
                Server only
              </button>
              <button
                type="button"
                onClick={() => setStorageMode('both')}
                className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                  storageMode === 'both'
                    ? 'bg-[var(--app-accent)]/20 border-purple-500 text-purple-200'
                    : 'bg-slate-900 border-[var(--app-panel-border)] text-slate-300 hover:border-slate-600'
                }`}
              >
                Client + server
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Server mode stores an encrypted key in your account vault and requires auth.
            </p>
          </div>

          {config.type === 'openapi' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={config.baseUrl || ''}
                  onChange={(e) => {
                    let value = e.target.value.trim();
                    value = value.replace(/\/+$/, '');
                    setConfig({ ...config, baseUrl: value });
                  }}
                  onBlur={(e) => {
                    let value = e.target.value.trim();
                    value = value.replace(/\/+$/, '');
                    if (value !== config.baseUrl) {
                      setConfig({ ...config, baseUrl: value });
                    }
                  }}
                  className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
                  placeholder="https://api.example.com/v1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Base URL for your OpenAPI-compatible endpoint (e.g., http://localhost:8000). Trailing slashes are automatically removed.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">
                  Auth Header Name
                </label>
                <input
                  type="text"
                  value={config.authHeader || 'Authorization'}
                  onChange={(e) => setConfig({ ...config, authHeader: e.target.value })}
                  className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
                  placeholder="Authorization or x-litellm-api-key"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Header name for authentication (e.g., "Authorization", "x-litellm-api-key")
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">
                  Auth Prefix
                </label>
                <input
                  type="text"
                  value={config.authPrefix || 'Bearer '}
                  onChange={(e) => setConfig({ ...config, authPrefix: e.target.value })}
                  className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
                  placeholder="Bearer "
                />
                <p className="text-xs text-slate-500 mt-1">
                  Prefix for auth header value (e.g., "Bearer ", "ApiKey ", or leave empty)
                </p>
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-400">
                Model
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFetchModels();
                }}
                disabled={isFetchingModels || (config.type !== 'openapi' && !config.apiKey)}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetchingModels ? 'Fetching...' : 'Fetch Models'}
              </button>
            </div>
            
            {availableModels.length > 0 ? (
              <div className="relative" ref={modelDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsModelDropdownOpen(!isModelDropdownOpen);
                  }}
                  className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50 flex items-center justify-between text-left"
                >
                  <span className="truncate">
                    {config.model || 'Select a model...'}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`w-4 h-4 transition-transform flex-shrink-0 ${isModelDropdownOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--app-panel)] border border-[var(--app-panel-border)] rounded-lg shadow-xl z-50 flex flex-col max-h-60">
                    <div className="p-2 border-b border-[var(--app-panel-border)]">
                      <input
                        ref={modelSearchInputRef}
                        type="text"
                        value={modelSearchQuery}
                        onChange={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setModelSearchQuery(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (filteredModels.length > 0) {
                              handleModelSelect(filteredModels[0]);
                            }
                          }
                          if (e.key === 'Escape') {
                            setIsModelDropdownOpen(false);
                            setModelSearchQuery('');
                          }
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        placeholder="Search models..."
                        className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
                      />
                    </div>
                    
                    <div className="overflow-y-auto max-h-48">
                      {filteredModels.length > 0 ? (
                        filteredModels.map((model) => (
                          <button
                            key={model}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleModelSelect(model);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors flex items-center justify-between hover:bg-[var(--app-tab-hover)]/50
                              ${config.model === model
                                ? 'bg-[var(--app-accent)]/20 text-purple-300'
                                : 'text-slate-300 hover:text-white'
                              }`}
                          >
                            <span className="truncate">{model}</span>
                            {config.model === model && (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[var(--app-accent)] flex-shrink-0">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-400 text-center">
                          No models match "{modelSearchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={config.model || ''}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full bg-slate-900 border border-[var(--app-panel-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50"
                placeholder={config.type === 'gemini' ? 'gemini-3-flash-preview' : 'Enter model name'}
              />
            )}

            {modelFetchError && (
              <p className="text-xs text-red-400 mt-1">{modelFetchError}</p>
            )}

            {config.type === 'gemini' && !availableModels.length && (
              <p className="text-xs text-slate-500 mt-1">
                Common models: gemini-3-flash-preview, gemini-2.5-flash, gemini-1.5-pro
              </p>
            )}
          </div>
        </div>

        <div className={`flex gap-3 justify-end mt-6 pt-4 border-t border-[var(--app-panel-border)] ${isEmbedded ? 'p-6 pb-6 pt-4' : ''}`}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          {saveError && <p className="text-xs text-red-400 self-center mr-auto">{saveError}</p>}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }}
            disabled={isSaving}
            className="px-4 py-2 bg-[var(--app-accent)] text-white rounded-lg hover:bg-[var(--app-accent)] transition-colors disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
  );
  
  if (isEmbedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {content}
    </div>
  );
};
