
// @ts-ignore
import { Muxer, ArrayBufferTarget, FileSystemWritableFileStreamTarget } from 'webm-muxer';
import { Qt6Style } from '../types';

// Declarations for WebCodecs API
declare class AudioEncoder {
  constructor(init: { output: (chunk: any, meta: any) => void; error: (e: any) => void });
  configure(config: { codec: string; numberOfChannels: number; sampleRate: number; bitrate: number }): void;
  encode(data: AudioData): void;
  flush(): Promise<void>;
  close(): void;
}

declare class AudioData {
  constructor(init: {
    format: string;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: Float32Array;
  });
  close(): void;
}

declare class VideoEncoder {
    constructor(init: { output: (chunk: any, meta: any) => void; error: (e: any) => void });
    configure(config: any): void;
    encode(frame: any, options?: any): void;
    flush(): Promise<void>;
    close(): void;
    readonly encodeQueueSize: number;
}

declare class VideoFrame {
    constructor(image: CanvasImageSource, init?: { timestamp: number });
    close(): void;
}

export const performOfflineRender = async (
    audioSrc: string,
    canvas: HTMLCanvasElement,
    config: {
        width: number;
        height: number;
        bitrate: number;
        title: string;
        visualMode: 'cover' | 'qt6';
        qt6Style: Qt6Style;
        customVideo?: HTMLVideoElement | null;
        customBgType?: 'image' | 'video';
    },
    onProgress: (progress: number) => void,
    onRenderFrame: (ctx: CanvasRenderingContext2D, time: number, data: Uint8Array | Float32Array) => void
) => {
    const formatErr = (err: unknown): string => {
        if (err instanceof Error) return `${err.name}: ${err.message}`;
        if (typeof err === 'string') return err;
        try { return JSON.stringify(err); } catch { return String(err); }
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const performMediaRecorderFallback = async (
        filename: string,
        targetWidth: number,
        targetHeight: number,
        audioBitrate: number,
        visualMode: 'cover' | 'qt6',
        qt6Style: Qt6Style,
        customVideo?: HTMLVideoElement | null
    ) => {
        const mediaRecorderClass = (window as any).MediaRecorder;
        if (!mediaRecorderClass) {
            throw new Error("This browser supports neither WebCodecs nor MediaRecorder fallback.");
        }

        const audioEl = document.createElement('audio');
        audioEl.crossOrigin = 'anonymous';
        audioEl.src = audioSrc;
        audioEl.preload = 'auto';
        audioEl.muted = true;

        await new Promise<void>((resolve, reject) => {
            audioEl.onloadedmetadata = () => resolve();
            audioEl.onerror = () => reject(new Error("Failed to load audio for fallback rendering."));
        });

        const duration = audioEl.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new Error("Invalid audio duration for fallback rendering.");
        }

        const audioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxClass) {
            throw new Error("AudioContext is unavailable for fallback rendering.");
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error("Could not acquire canvas 2D context.");
        }
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const audioCtx = new audioCtxClass();
        const source = audioCtx.createMediaElementSource(audioEl);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        const dest = audioCtx.createMediaStreamDestination();
        source.connect(analyser);
        source.connect(dest);

        const canvasStream = canvas.captureStream(60);
        const combinedTracks: MediaStreamTrack[] = [
            ...canvasStream.getVideoTracks(),
            ...dest.stream.getAudioTracks(),
        ];
        const combinedStream = new MediaStream(combinedTracks);

        const mimeCandidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
        ];
        const supportedMime = mimeCandidates.find((m) => mediaRecorderClass.isTypeSupported?.(m));
        if (!supportedMime) {
            throw new Error("No supported MediaRecorder MIME type found (expected webm).");
        }

        const chunks: BlobPart[] = [];
        const recorder = new mediaRecorderClass(combinedStream, {
            mimeType: supportedMime,
            videoBitsPerSecond: 8_000_000,
            audioBitsPerSecond: audioBitrate,
        });

        recorder.ondataavailable = (event: BlobEvent) => {
            if (event.data && event.data.size > 0) chunks.push(event.data);
        };

        const stopPromise = new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
        });

        let rafId = 0;
        let stopped = false;
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        const stopAll = () => {
            if (stopped) return;
            stopped = true;
            cancelAnimationFrame(rafId);
            if (customVideo && !customVideo.paused) customVideo.pause();
            if (!audioEl.paused) audioEl.pause();
            if (recorder.state !== 'inactive') recorder.stop();
            combinedTracks.forEach((t) => t.stop());
            audioCtx.close().catch(() => undefined);
        };

        const drawLoop = () => {
            if (stopped) return;
            const t = Math.min(audioEl.currentTime, duration);

            if (visualMode === 'cover' && config.customBgType === 'video' && customVideo && customVideo.duration > 0) {
                const loopTime = t % customVideo.duration;
                if (Math.abs(customVideo.currentTime - loopTime) > 0.2) {
                    customVideo.currentTime = loopTime;
                }
            }

            if (qt6Style === 'wave') {
                analyser.getByteTimeDomainData(freqData);
            } else {
                analyser.getByteFrequencyData(freqData);
            }

            onRenderFrame(ctx, t, freqData);
            onProgress((t / duration) * 100);

            if (t >= duration - 0.02 || audioEl.ended) {
                onProgress(100);
                stopAll();
                return;
            }
            rafId = requestAnimationFrame(drawLoop);
        };

        recorder.start(250);
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        if (visualMode === 'cover' && config.customBgType === 'video' && customVideo) {
            customVideo.muted = true;
            customVideo.loop = true;
            customVideo.play().catch(() => undefined);
        }
        await audioEl.play();
        rafId = requestAnimationFrame(drawLoop);

        await stopPromise;

        const blob = new Blob(chunks, { type: supportedMime });
        if (!blob.size) {
            throw new Error("Fallback renderer produced an empty video blob.");
        }
        downloadBlob(blob, filename);
    };

    try {
        const w = window as any;
        const WebVideoEncoder = w.VideoEncoder;
        const WebAudioEncoder = w.AudioEncoder;
        const WebAudioData = w.AudioData;
        const WebVideoFrame = w.VideoFrame;
        const WebOfflineAudioContext = w.OfflineAudioContext || w.webkitOfflineAudioContext;

        const supportsWebCodecs = !!(WebVideoEncoder && WebAudioEncoder && WebAudioData && WebVideoFrame && WebOfflineAudioContext);

        if (!audioSrc) {
            throw new Error("Audio source is missing.");
        }

        const { width: targetWidth, height: targetHeight, bitrate, title, visualMode, qt6Style, customVideo } = config;
        const filename = `${(title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_suno_architect.webm`;

        if (!supportsWebCodecs) {
            await performMediaRecorderFallback(filename, targetWidth, targetHeight, bitrate, visualMode, qt6Style, customVideo);
            return;
        }

        // 1. Fetch & Decode Audio
        const response = await fetch(audioSrc);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio: HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        const audioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const tempCtx = new audioContextClass();
        const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
        
        // We use OfflineAudioContext for extracting analysis data frame-by-frame
        const offlineCtx = new WebOfflineAudioContext(2, decodedBuffer.length, decodedBuffer.sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = decodedBuffer;
        
        // Setup Analysis for Offline
        const analyser = offlineCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(offlineCtx.destination);
        source.start(0);

        const duration = source.buffer.duration;
        
        // Setup Muxer & Encoders
        let muxerTarget: any;
        if ('showSaveFilePicker' in window) {
            try {
                const fileHandle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'WebM Video', accept: { 'video/webm': ['.webm'] } }],
                });
                const writableStream = await fileHandle.createWritable();
                muxerTarget = new FileSystemWritableFileStreamTarget(writableStream);
            } catch (err: any) {
                if (err.name === 'AbortError') { 
                    throw new Error("Render Cancelled");
                }
                console.warn("File System Access failed, falling back to RAM.", err);
            }
        }
        if (!muxerTarget) muxerTarget = new ArrayBufferTarget();

        const muxer = new Muxer({
            target: muxerTarget,
            video: { codec: 'V_VP9', width: targetWidth, height: targetHeight },
            audio: { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: 48000 }
        });

        let encoderFailure: Error | null = null;

        const videoEncoder = new WebVideoEncoder({
            output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
            error: (e: any) => {
                encoderFailure = new Error(`Video encoder error: ${formatErr(e)}`);
                console.error("Video Encoder error", e);
            }
        });
        videoEncoder.configure({
            codec: 'vp09.00.10.08', width: targetWidth, height: targetHeight, bitrate: 8_000_000, framerate: 60
        });

        const audioEncoder = new WebAudioEncoder({
            output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
            error: (e: any) => {
                encoderFailure = new Error(`Audio encoder error: ${formatErr(e)}`);
                console.error("Audio Encoder error", e);
            }
        });
        audioEncoder.configure({ codec: 'opus', numberOfChannels: 2, sampleRate: 48000, bitrate: bitrate });

        const fps = 60;
        const totalFrames = Math.ceil(duration * fps);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error("Could not acquire canvas 2D context.");
        }
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        let frameIndex = 0;
        
        const processFrame = async () => {
            const t = frameIndex / fps;
            
            // Sync custom video background if needed
            if (visualMode === 'cover' && config.customBgType === 'video' && customVideo) {
                const loopTime = t % customVideo.duration;
                // Basic seek emulation
                customVideo.currentTime = loopTime; 
            }

            // Extract Data
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            if (qt6Style === 'wave') {
                analyser.getByteTimeDomainData(freqData);
            } else {
                analyser.getByteFrequencyData(freqData);
            }

            // Callback to main render logic
            onRenderFrame(ctx, t, freqData);
            
            const frame = new WebVideoFrame(canvas, { timestamp: t * 1000000 });
            videoEncoder.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 });
            frame.close();

            if (videoEncoder.encodeQueueSize > 5) {
                await videoEncoder.flush();
            }

            frameIndex++;
            onProgress((frameIndex / totalFrames) * 100);
            
            if (frameIndex < totalFrames) {
                // Yield to event loop
                await new Promise(resolve => setTimeout(resolve, 0));
                
                // Suspend context to specific time to get accurate analysis data
                offlineCtx.suspend((frameIndex) / fps).then(processFrame).then(() => offlineCtx.resume());
            } else {
                offlineCtx.resume(); 
            }
        };

        // Trigger first frame at 0
        offlineCtx.suspend(0).then(processFrame).then(() => offlineCtx.resume());
        
        // Start Processing
        await offlineCtx.startRendering();

        // Encode Audio Track
        const sourceBuffer = decodedBuffer;
        const numberOfChannels = 2;
        const audioDataLength = sourceBuffer.length;
        const sourceSampleRate = sourceBuffer.sampleRate;
        const chunkFrames = 48000;
        
        for (let offset = 0; offset < audioDataLength; offset += chunkFrames) {
            const end = Math.min(offset + chunkFrames, audioDataLength);
            const frames = end - offset;
            const data = new Float32Array(frames * numberOfChannels);
            for (let ch = 0; ch < numberOfChannels; ch++) {
                const srcData = sourceBuffer.getChannelData(ch < sourceBuffer.numberOfChannels ? ch : 0);
                data.set(srcData.subarray(offset, end), ch * frames);
            }
            const audioData = new WebAudioData({
                format: 'f32-planar', sampleRate: sourceSampleRate, numberOfFrames: frames, numberOfChannels: numberOfChannels, timestamp: (offset / sourceSampleRate) * 1000000, data: data
            });
            audioEncoder.encode(audioData);
            audioData.close();
        }

        await videoEncoder.flush();
        await audioEncoder.flush();
        if (encoderFailure) {
            throw encoderFailure;
        }
        muxer.finalize();

        // Handle File Download
        if (muxerTarget instanceof ArrayBufferTarget) {
            const { buffer } = muxerTarget;
            const blob = new Blob([buffer], { type: 'video/webm' });
            downloadBlob(blob, filename);
        } else if (muxerTarget instanceof FileSystemWritableFileStreamTarget) {
             // @ts-ignore
             if(muxerTarget.stream) await muxerTarget.stream.close();
        }

    } catch (e: any) {
        if (e.message !== "Render Cancelled") {
            console.error("Offline render failed", e);
            throw new Error(`Offline render failed: ${formatErr(e)}`);
        }
        throw e;
    }
};
