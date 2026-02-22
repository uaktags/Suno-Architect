import { Qt6Style } from '../types';
import type { VisualizerFrameData } from './visualizer';
import { saveVisualizerRender } from '../services/offlineDb';

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
    onRenderFrame: (ctx: CanvasRenderingContext2D, time: number, data: VisualizerFrameData) => void
) => {
    return new Promise<void>((resolve, reject) => {
        onProgress(0);
        
        const audio = new Audio(audioSrc);
        audio.crossOrigin = 'anonymous';
        
        let audioCtx: AudioContext | null = null;
        let dest: MediaStreamAudioDestinationNode | null = null;
        let sourceNode: MediaElementAudioSourceNode | null = null;
        
        const chunks: BlobPart[] = [];
        let mediaRecorder: MediaRecorder | null = null;
        let renderRAF: number | null = null;
        const ctx = canvas.getContext('2d')!;

        const cleanup = () => {
            if (renderRAF) cancelAnimationFrame(renderRAF);
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            if (audio) {
                audio.pause();
                audio.src = '';
            }
            if (audioCtx) {
                audioCtx.close().catch(console.error);
            }
        };

        audio.onloadedmetadata = () => {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            dest = audioCtx.createMediaStreamDestination();
            sourceNode = audioCtx.createMediaElementSource(audio);
            
            sourceNode.connect(audioCtx.destination);
            sourceNode.connect(dest);

            const canvasStream = canvas.captureStream(config.fps);
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) {
                canvasStream.addTrack(audioTrack);
            }

            try {
                mediaRecorder = new MediaRecorder(canvasStream, {
                    mimeType: 'video/webm;codecs=vp9,opus',
                    videoBitsPerSecond: config.videoBitrate,
                    audioBitsPerSecond: config.bitrate
                });
            } catch (e) {
                // Fallback for unsupported vp9/opus
                mediaRecorder = new MediaRecorder(canvasStream, {
                    mimeType: 'video/webm',
                    videoBitsPerSecond: config.videoBitrate,
                    audioBitsPerSecond: config.bitrate
                });
            }

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                try {
                    const id = `render_${Date.now()}`;
                    await saveVisualizerRender({
                        id,
                        clipId: `clip_${Date.now()}`, // We don't have the exact clipId passed, but we can store it from config or caller
                        clipTitle: config.title,
                        createdAt: Date.now(),
                        settings: config,
                        mediaBlob: blob,
                        mimeType: 'video/webm',
                        fileSize: blob.size
                    });
                    
                    // Also trigger download as fallback/convenience
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${config.title || 'rendered'}.webm`;
                    a.click();
                    URL.revokeObjectURL(url);
                    
                    resolve();
                } catch (e: any) {
                    if (e.name === 'QuotaExceededError') {
                        reject(new Error("Storage quota exceeded. Please delete old renders from History."));
                    } else {
                        reject(e);
                    }
                }
            };

            const duration = audio.duration;
            audio.play().then(() => {
                mediaRecorder?.start();
                
                const drawLoop = () => {
                    if (!audio.paused && !audio.ended) {
                        const time = audio.currentTime;
                        onRenderFrame(ctx, time, new Uint8Array(0)); // Mocking data for now
                        onProgress((time / duration) * 100);
                        renderRAF = requestAnimationFrame(drawLoop);
                    } else if (audio.ended) {
                        onProgress(100);
                        mediaRecorder?.stop();
                    }
                };
                
                drawLoop();
            }).catch(e => {
                cleanup();
                reject(e);
            });
        };

        audio.onerror = (e) => {
            cleanup();
            reject(new Error("Failed to load audio for rendering."));
        };
    });
};
