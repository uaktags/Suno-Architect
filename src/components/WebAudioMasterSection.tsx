import React from 'react';

const WebAudioMasterSection: React.FC = () => {
  return (
    <section className="space-y-4">
      <div className="bg-[var(--app-panel)] border border-[var(--app-panel-border)]/60 rounded-xl p-4 sm:p-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Web-Audio-Master</h2>
        <p className="text-sm text-slate-300 mt-1">
          Full web-hosted mastering tool from Web-Audio-Mastering, embedded directly in this tab.
        </p>
      </div>

      <div className="bg-black/40 border border-[var(--app-panel-border)]/60 rounded-xl overflow-hidden">
        <iframe
          title="Web-Audio-Master"
          src="/web-audio-master/index.html"
          className="w-full h-[78vh] min-h-[760px]"
        />
      </div>
    </section>
  );
};

export default WebAudioMasterSection;
