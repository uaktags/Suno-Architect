import React from 'react';
import { AppCard } from './ui/AppPrimitives';

const WebAudioMasterSection: React.FC = () => {
  return (
    <section className="max-w-7xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Web-Audio-Master</h2>
        <p className="text-sm text-slate-400 mt-1">
          Full web-hosted mastering tool from Web-Audio-Mastering, embedded directly in this tab.
        </p>
      </div>

      <AppCard className="bg-black/40 border-[var(--app-panel-border)]/60 rounded-xl overflow-hidden p-0">
        <iframe
          title="Web-Audio-Master"
          src="/web-audio-master/index.html"
          className="w-full h-[78vh] min-h-[760px]"
        />
      </AppCard>
    </section>
  );
};

export default WebAudioMasterSection;
