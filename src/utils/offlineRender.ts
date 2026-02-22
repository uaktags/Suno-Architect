import { Qt6Style } from '../types';
import QRCode from 'qrcode';

const MAX_FRAMES_IN_FLIGHT = 10;
let framesInFlight = 0;
let resolvePushback: (() => void) | null = null;

export const performOfflineRender = async (
    audioSrc: string,
    canvas: HTMLCanvasElement,
    config: {
        width: number;
        height: number;
        bitrate: number;
        videoBitrate: number;
        videoBitrateMode: 'constant' | 'variable';
        fps: number;
        title: string;
        visualMode: 'cover' | 'qt6' | 'hybrid';
        qt6Style: Qt6Style;
        customVideo?: HTMLVideoElement | null;
        customBgType?: 'image' | 'video';
        outputAspectTarget?: 'landscape' | 'portrait';
        preRoll?: {
            enabled: boolean;
            type: 'text' | 'qr';
            text: string;
            seconds: number;
        };
        postRoll?: {
            enabled: boolean;
            type: 'text' | 'qr';
            text: string;
            seconds: number;
        };
    },
    onProgress: (progress: number) => void,
    onRenderFrame: (ctx: CanvasRenderingContext2D, time: number, data: Uint8Array | Float32Array) => void
) => {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const worker = new Worker(new URL('./offlineRender.worker.ts', import.meta.url), { type: 'module' });
            const fps = config.fps || 30;
            // CHANGED: File extension to .mp4
            const filename = `${(config.title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_suno_architect.mp4`;

            let resolveWorkerReady: () => void;
            const workerReadyPromise = new Promise<void>((res) => { resolveWorkerReady = res; });

            worker.onmessage = (e) => {
                if (e.data.type === 'INIT_DONE') {
                    resolveWorkerReady();
                } else if (e.data.type === 'FRAME_ENCODED') {
                    framesInFlight--;
                    if (resolvePushback && framesInFlight < MAX_FRAMES_IN_FLIGHT) {
                        resolvePushback();
                        resolvePushback = null;
                    }
                } else if (e.data.type === 'DONE') {
                    if (e.data.buffer) {
                        triggerDownload(e.data.buffer, filename);
                    }
                    worker.terminate();
                    resolve();
                } else if (e.data.type === 'ERROR') {
                    worker.terminate();
                    reject(new Error(e.data.message));
                }
            };

            const response = await fetch(audioSrc);
            const arrayBuffer = await response.arrayBuffer();

            const audioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const tempCtx = new audioContextClass();
            const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
            
            const offlineCtx = new OfflineAudioContext(2, decodedBuffer.length, decodedBuffer.sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = decodedBuffer;
            
            const analyser = offlineCtx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyser.connect(offlineCtx.destination);
            source.start(0);

            const duration = source.buffer.duration;
            const totalFrames = Math.ceil(duration * fps);
            const ctx = canvas.getContext('2d')!;
            canvas.width = config.width;
            canvas.height = config.height;

            let fileHandle = null;
            if ('showSaveFilePicker' in window) {
                try {
                    fileHandle = await (window as any).showSaveFilePicker({
                        suggestedName: filename,
                        // CHANGED: File picker accepts MP4
                        types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
                    });
                } catch (err: any) {
                    if (err.name === 'AbortError') return reject(new Error("Render Cancelled"));
                    console.warn("File System Access failed, falling back to RAM.", err);
                }
            }

            const channelData = [];
            for (let i = 0; i < decodedBuffer.numberOfChannels; i++) {
                channelData.push(decodedBuffer.getChannelData(i));
            }

            const { customVideo, ...workerConfig } = config;

            const createStaticCardBlob = async (
                card: { enabled: boolean; type: 'text' | 'qr'; text: string; seconds: number } | undefined,
                width: number,
                height: number,
                fallbackTitle: string
            ): Promise<ArrayBuffer | null> => {
                if (!card?.enabled || !card.text.trim() || card.seconds <= 0) return null;

                const cardCanvas = document.createElement('canvas');
                cardCanvas.width = width;
                cardCanvas.height = height;
                const c = cardCanvas.getContext('2d');
                if (!c) return null;

                const gradient = c.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#0a0a0a');
                gradient.addColorStop(1, '#1f2937');
                c.fillStyle = gradient;
                c.fillRect(0, 0, width, height);

                c.strokeStyle = '#475569';
                c.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.004));
                c.strokeRect(16, 16, width - 32, height - 32);

                c.fillStyle = '#94a3b8';
                c.font = `600 ${Math.max(18, Math.round(width * 0.02))}px 'Courier Prime', monospace`;
                c.textAlign = 'center';
                c.textBaseline = 'top';
                c.fillText(fallbackTitle.toUpperCase(), width / 2, Math.round(height * 0.08));

                if (card.type === 'qr') {
                    const qrSize = Math.round(Math.min(width, height) * 0.42);
                    const qrCanvas = document.createElement('canvas');
                    await QRCode.toCanvas(qrCanvas, card.text.trim(), {
                        width: qrSize,
                        margin: 1,
                        color: {
                            dark: '#f8fafc',
                            light: '#0b1120'
                        }
                    });
                    const x = Math.round((width - qrSize) / 2);
                    const y = Math.round((height - qrSize) / 2) - Math.round(height * 0.05);
                    c.drawImage(qrCanvas, x, y);
                }

                c.fillStyle = '#e2e8f0';
                c.font = `700 ${Math.max(24, Math.round(width * 0.04))}px Inter, sans-serif`;
                c.textBaseline = 'middle';

                const lines = card.text
                    .trim()
                    .split('\n')
                    .flatMap((line) => {
                        if (line.length <= 42) return [line];
                        const chunks: string[] = [];
                        let current = '';
                        line.split(' ').forEach((word) => {
                            const candidate = current ? `${current} ${word}` : word;
                            if (candidate.length > 42) {
                                if (current) chunks.push(current);
                                current = word;
                            } else {
                                current = candidate;
                            }
                        });
                        if (current) chunks.push(current);
                        return chunks;
                    })
                    .slice(0, 5);

                const textTop = card.type === 'qr' ? Math.round(height * 0.78) : Math.round(height * 0.45);
                lines.forEach((line, idx) => {
                    c.fillText(line, width / 2, textTop + idx * Math.round(height * 0.06));
                });

                const blob = await new Promise<Blob | null>((resolveBlob) => cardCanvas.toBlob(resolveBlob, 'image/png'));
                if (!blob) return null;
                return blob.arrayBuffer();
            };

            const [preRollImage, postRollImage] = await Promise.all([
                createStaticCardBlob(config.preRoll, config.width, config.height, 'Pre-Roll Message'),
                createStaticCardBlob(config.postRoll, config.width, config.height, 'Post-Roll Message')
            ]);

            worker.postMessage({
                type: 'INIT',
                config: workerConfig, 
                fps,
                fileHandle, 
                audioData: {
                    channels: channelData,
                    sampleRate: decodedBuffer.sampleRate,
                    length: decodedBuffer.length,
                    numberOfChannels: decodedBuffer.numberOfChannels
                },
                preRollImage,
                postRollImage
            });

            await workerReadyPromise;

            let frameIndex = 0;

            const processFrame = async () => {
                const t = frameIndex / fps;

                if (framesInFlight >= MAX_FRAMES_IN_FLIGHT) {
                    await new Promise<void>(res => { resolvePushback = res; });
                }

                if (config.visualMode !== 'qt6' && config.customBgType === 'video' && config.customVideo) {
                    config.customVideo.currentTime = t % config.customVideo.duration;
                }

                const freqData = new Uint8Array(analyser.frequencyBinCount);
                if (config.qt6Style === 'wave') {
                    analyser.getByteTimeDomainData(freqData);
                } else {
                    analyser.getByteFrequencyData(freqData);
                }

                onRenderFrame(ctx, t, freqData);

                const bitmap = await createImageBitmap(canvas);

                framesInFlight++;
                worker.postMessage({
                    type: 'ENCODE_FRAME',
                    bitmap,
                    time: t,
                    keyFrame: frameIndex % (fps * 2) === 0
                }, [bitmap]);

                frameIndex++;
                onProgress((frameIndex / totalFrames) * 100);

                if (frameIndex < totalFrames) {
                    offlineCtx.suspend(frameIndex / fps).then(processFrame).then(() => offlineCtx.resume());
                } else {
                    worker.postMessage({ type: 'FINALIZE' });
                    offlineCtx.resume();
                }
            };

            offlineCtx.suspend(0).then(processFrame).then(() => offlineCtx.resume());
            await offlineCtx.startRendering();

        } catch (e: any) {
            console.error("Offline render failed", e);
            reject(e);
        }
    });
};

const triggerDownload = (buffer: ArrayBuffer, filename: string) => {
    // CHANGED: Blob mime type to video/mp4
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
