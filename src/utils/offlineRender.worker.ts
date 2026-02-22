import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource } from 'mediabunny';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

if (typeof globalThis.AudioBuffer === 'undefined') {
  (globalThis as any).AudioBuffer = class AudioBuffer {
    length: number;
    numberOfChannels: number;
    sampleRate: number;
    duration: number;
    _channels: Float32Array[];
    constructor(options: { length: number; numberOfChannels: number; sampleRate: number }) {
      this.length = options.length;
      this.numberOfChannels = options.numberOfChannels;
      this.sampleRate = options.sampleRate;
      this.duration = this.length / this.sampleRate;
      this._channels = new Array(this.numberOfChannels);
    }
    getChannelData(channel: number) { return this._channels[channel]; }
    copyToChannel(source: Float32Array, channelNumber: number, bufferOffset = 0) {
      if (!this._channels[channelNumber]) this._channels[channelNumber] = new Float32Array(this.length);
      this._channels[channelNumber].set(source, bufferOffset);
    }
    copyFromChannel(destination: Float32Array, channelNumber: number, bufferOffset = 0) {
      const source = this._channels[channelNumber].subarray(bufferOffset, bufferOffset + destination.length);
      destination.set(source);
    }
  };
}

let output: Output;
let videoSource: CanvasSource;
let audioSource: AudioBufferSource;
let offscreenCanvas: OffscreenCanvas;
let offscreenCtx: OffscreenCanvasRenderingContext2D;
let mainTarget: BufferTarget;
let fps = 30;
let ffmpeg: FFmpeg | null = null;
let fileHandle: any = null;
let preRollImage: ArrayBuffer | null = null;
let postRollImage: ArrayBuffer | null = null;
let renderConfig: any = null;

const TARGETS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 }
} as const;

const ensureFfmpegLoaded = async () => {
  if (!ffmpeg) ffmpeg = new FFmpeg();
  if (!ffmpeg.loaded) {
    await ffmpeg.load({ coreURL, wasmURL });
  }
};

const normalizeFilter = (target: 'landscape' | 'portrait') => {
  const { width, height } = TARGETS[target];
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,crop=${width}:${height}`;
};

const safeDelete = async (path: string) => {
  if (!ffmpeg) return;
  try { await ffmpeg.deleteFile(path); } catch { /* noop */ }
};

self.onmessage = async (e) => {
  try {
    const { type } = e.data;

    if (type === 'INIT') {
      const { config, fps: initFps, fileHandle: incomingHandle, audioData, preRollImage: preImg, postRollImage: postImg } = e.data;
      fps = initFps;
      renderConfig = config;
      fileHandle = incomingHandle;
      preRollImage = preImg || null;
      postRollImage = postImg || null;

      mainTarget = new BufferTarget();
      output = new Output({
        format: new Mp4OutputFormat(),
        target: mainTarget
      });

      offscreenCanvas = new OffscreenCanvas(config.width, config.height);
      offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

      videoSource = new CanvasSource(offscreenCanvas, {
        codec: 'avc',
        bitrate: config.videoBitrate || 5_000_000,
        bitrateMode: config.videoBitrateMode || 'variable'
      });
      output.addVideoTrack(videoSource, { frameRate: fps });

      const useFlac = (config.bitrate || 0) > 192000;
      audioSource = new AudioBufferSource({
        codec: useFlac ? 'pcm-s16' : 'aac',
        ...(!useFlac && { bitrate: config.bitrate || 128000 })
      });

      output.addAudioTrack(audioSource);
      await output.start();

      const reconstructedAudioBuffer = new AudioBuffer({
        length: audioData.length,
        numberOfChannels: audioData.numberOfChannels,
        sampleRate: audioData.sampleRate
      });

      for (let i = 0; i < audioData.numberOfChannels; i++) {
        reconstructedAudioBuffer.copyToChannel(audioData.channels[i], i);
      }

      await audioSource.add(reconstructedAudioBuffer as any);
      self.postMessage({ type: 'INIT_DONE' });
    }

    if (type === 'ENCODE_FRAME') {
      const { bitmap, time, keyFrame } = e.data;
      offscreenCtx.drawImage(bitmap, 0, 0);
      bitmap.close();
      await videoSource.add(time, 1 / fps, { keyFrame });
      self.postMessage({ type: 'FRAME_ENCODED' });
    }

    if (type === 'FINALIZE') {
      await output.finalize();
      await ensureFfmpegLoaded();

      const targetAspect: 'landscape' | 'portrait' = renderConfig?.outputAspectTarget === 'portrait' ? 'portrait' : 'landscape';
      const filter = normalizeFilter(targetAspect);
      const preSeconds = Math.max(1, Number(renderConfig?.preRoll?.seconds || 0));
      const postSeconds = Math.max(1, Number(renderConfig?.postRoll?.seconds || 0));

      if (!mainTarget.buffer) {
        throw new Error('Main render buffer is empty.');
      }
      await ffmpeg!.writeFile('main.mp4', new Uint8Array(mainTarget.buffer));

      let finalInput = 'main.mp4';
      const cleanupFiles = ['main.mp4', 'final.mp4'];

      if (preRollImage || postRollImage) {
        if (preRollImage) {
          await ffmpeg!.writeFile('preroll.png', new Uint8Array(preRollImage));
          cleanupFiles.push('preroll.png', 'preroll.mp4');
          await ffmpeg!.exec([
            '-loop', '1', '-i', 'preroll.png', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-t', String(preSeconds), '-vf', filter, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'preroll.mp4'
          ]);
        }

        if (postRollImage) {
          await ffmpeg!.writeFile('postroll.png', new Uint8Array(postRollImage));
          cleanupFiles.push('postroll.png', 'postroll.mp4');
          await ffmpeg!.exec([
            '-loop', '1', '-i', 'postroll.png', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-t', String(postSeconds), '-vf', filter, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'postroll.mp4'
          ]);
        }

        await ffmpeg!.exec([
          ...(preRollImage ? ['-i', 'preroll.mp4'] : []),
          '-i', 'main.mp4',
          ...(postRollImage ? ['-i', 'postroll.mp4'] : []),
          '-filter_complex', `${preRollImage ? '[0:v:0][0:a:0]' : ''}${preRollImage ? '[1:v:0][1:a:0]' : '[0:v:0][0:a:0]'}${postRollImage ? `${preRollImage ? '[2:v:0][2:a:0]' : '[1:v:0][1:a:0]'}` : ''}concat=n=${1 + (preRollImage ? 1 : 0) + (postRollImage ? 1 : 0)}:v=1:a=1[v][a]`,
          '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', 'final.mp4'
        ]);
        finalInput = 'final.mp4';
      } else {
        await ffmpeg!.exec(['-i', 'main.mp4', '-vf', filter, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', 'final.mp4']);
        finalInput = 'final.mp4';
      }

      const finalData = await ffmpeg!.readFile(finalInput);
      const finalBuffer = finalData instanceof Uint8Array ? finalData.buffer.slice(finalData.byteOffset, finalData.byteOffset + finalData.byteLength) : finalData;

      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(finalBuffer);
        await writable.close();
      }

      for (const file of cleanupFiles) {
        await safeDelete(file);
      }

      (self as any).postMessage({ type: 'DONE', buffer: finalBuffer }, [finalBuffer as ArrayBuffer]);
    }
  } catch (err: any) {
    (self as any).postMessage({ type: 'ERROR', message: err?.message || 'Worker Error' });
  }
};
