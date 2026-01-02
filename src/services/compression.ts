import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import {
  CompressionSettings,
  CompressionResult,
  FileInfo,
  QualityLevel,
  AdvancedSettings,
} from '../types.js';
import { generateOutputPath, deleteFile } from '../utils.js';

interface CompressionProgress {
  percentage: number;
  currentFps?: number;
  currentKbps?: number;
}

// Quality settings maps
const VIDEO_SETTINGS: Record<QualityLevel, { crf: number; preset: string }> = {
  high: { crf: 23, preset: 'medium' },
  medium: { crf: 28, preset: 'medium' },
  low: { crf: 32, preset: 'fast' },
  custom: { crf: 28, preset: 'medium' },
};

const IMAGE_QUALITY: Record<QualityLevel, number> = {
  high: 2,   // ~85%
  medium: 5, // ~60%
  low: 10,   // ~35%
  custom: 5,
};

// Audio quality settings (bitrate in kbps)
const AUDIO_SETTINGS: Record<QualityLevel, { bitrate: number }> = {
  high: { bitrate: 320 },
  medium: { bitrate: 192 },
  low: { bitrate: 128 },
  custom: { bitrate: 192 },
};

// Video codec mapping for different output formats
const VIDEO_CODECS: Record<string, { vcodec: string; acodec: string }> = {
  mp4: { vcodec: 'libx264', acodec: 'aac' },
  webm: { vcodec: 'libvpx-vp9', acodec: 'libopus' },
  mov: { vcodec: 'libx264', acodec: 'aac' },
  mkv: { vcodec: 'libx264', acodec: 'aac' },
  avi: { vcodec: 'libx264', acodec: 'aac' },
};

// Audio codec mapping for different output formats
const AUDIO_CODECS: Record<string, string> = {
  mp3: 'libmp3lame',
  aac: 'aac',
  m4a: 'aac',
  ogg: 'libvorbis',
  flac: 'flac',
  wav: 'pcm_s16le',
  opus: 'libopus',
};

export class CompressionService {
  private parseTimeToSeconds(timeString: string): number {
    const parts = timeString.split(':');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  }

  private calculateResult(
    fileInfo: FileInfo,
    outputPath: string,
    startTime: number
  ): CompressionResult {
    const outputSize = fs.statSync(outputPath).size;
    const savedBytes = fileInfo.size - outputSize;
    const savedPercentage = (savedBytes / fileInfo.size) * 100;
    const duration = (Date.now() - startTime) / 1000;

    // If output is not smaller than input, delete the output file
    // This prevents creating files that are the same size or larger
    if (outputSize >= fileInfo.size) {
      try {
        fs.unlinkSync(outputPath);
      } catch {
        // Ignore deletion errors
      }
      return {
        inputPath: fileInfo.path,
        outputPath: fileInfo.path, // Point back to original file
        inputSize: fileInfo.size,
        outputSize: fileInfo.size, // No change
        savedBytes: 0,
        savedPercentage: 0,
        duration,
        alreadyOptimized: true,
      };
    }

    return {
      inputPath: fileInfo.path,
      outputPath,
      inputSize: fileInfo.size,
      outputSize,
      savedBytes,
      savedPercentage,
      duration,
    };
  }

  private getVideoSettings(quality: QualityLevel) {
    return VIDEO_SETTINGS[quality] || VIDEO_SETTINGS.medium;
  }

  private getImageQuality(quality: QualityLevel): number {
    return IMAGE_QUALITY[quality] || IMAGE_QUALITY.medium;
  }

  private getAudioSettings(quality: QualityLevel) {
    return AUDIO_SETTINGS[quality] || AUDIO_SETTINGS.medium;
  }

  private getAudioCodec(format: string): string {
    return AUDIO_CODECS[format] || AUDIO_CODECS.mp3;
  }

  private getOutputFormat(fileInfo: FileInfo, advanced?: AdvancedSettings): string {
    if (advanced?.outputFormat) {
      return advanced.outputFormat;
    }
    return fileInfo.extension;
  }

  private getVideoCodecs(format: string): { vcodec: string; acodec: string } {
    return VIDEO_CODECS[format] || VIDEO_CODECS.mp4;
  }

  // Get video duration in seconds
  private getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  // Calculate target bitrate for a specific file size
  private calculateTargetBitrate(targetBytes: number, durationSeconds: number): number {
    // Reserve 128kbps for audio
    const audioBitrate = 128 * 1024; // bits per second
    const audioBytes = (audioBitrate * durationSeconds) / 8;
    const videoBytes = targetBytes - audioBytes;
    // Return video bitrate in kbps
    return Math.max(100, Math.floor((videoBytes * 8) / (durationSeconds * 1000)));
  }

  async compressVideo(
    fileInfo: FileInfo,
    settings: CompressionSettings,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const outputPath = generateOutputPath(fileInfo.path, settings.advanced);
    const { crf, preset } = this.getVideoSettings(settings.quality);
    const outputFormat = this.getOutputFormat(fileInfo, settings.advanced);
    const { vcodec, acodec } = this.getVideoCodecs(outputFormat);

    // Check if we need target size encoding
    if (settings.advanced?.targetSize) {
      return this.compressVideoWithTargetSize(
        fileInfo,
        settings,
        outputPath,
        startTime,
        onProgress
      );
    }

    return new Promise((resolve, reject) => {
      let duration = 0;

      const command = ffmpeg(fileInfo.path);

      // Build output options based on format
      const outputOptions = [
        `-c:v ${vcodec}`,
        `-crf ${settings.crf || crf}`,
        `-preset ${preset}`,
        `-c:a ${acodec}`,
        `-b:a 128k`,
      ];

      // Add format-specific options
      if (outputFormat === 'webm') {
        outputOptions.push('-deadline good');
      }

      command
        .outputOptions(outputOptions)
        .on('codecData', (data) => {
          duration = this.parseTimeToSeconds(data.duration);
        })
        .on('progress', (progress) => {
          if (duration > 0 && progress.timemark) {
            const currentTime = this.parseTimeToSeconds(progress.timemark);
            const percentage = Math.min((currentTime / duration) * 100, 100);

            onProgress({
              percentage,
              currentFps: progress.currentFps,
              currentKbps: progress.currentKbps,
            });
          }
        })
        .on('end', () => {
          const result = this.calculateResult(fileInfo, outputPath, startTime);
          // Handle input file removal (only if compression was successful)
          if (settings.removeInputFile && !result.alreadyOptimized) {
            deleteFile(fileInfo.path);
            result.inputFileRemoved = true;
          }
          resolve(result);
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Two-pass encoding for target file size
  private async compressVideoWithTargetSize(
    fileInfo: FileInfo,
    settings: CompressionSettings,
    outputPath: string,
    startTime: number,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const targetSize = settings.advanced!.targetSize!;
    const duration = await this.getVideoDuration(fileInfo.path);
    const targetBitrate = this.calculateTargetBitrate(targetSize, duration);
    const outputFormat = this.getOutputFormat(fileInfo, settings.advanced);
    const { vcodec, acodec } = this.getVideoCodecs(outputFormat);
    const { preset } = this.getVideoSettings(settings.quality);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(fileInfo.path);

      const outputOptions = [
        `-c:v ${vcodec}`,
        `-b:v ${targetBitrate}k`,
        `-maxrate ${Math.floor(targetBitrate * 1.5)}k`,
        `-bufsize ${Math.floor(targetBitrate * 2)}k`,
        `-preset ${preset}`,
        `-c:a ${acodec}`,
        `-b:a 128k`,
      ];

      if (outputFormat === 'webm') {
        outputOptions.push('-deadline good');
      }

      command
        .outputOptions(outputOptions)
        .on('progress', (progress) => {
          if (duration > 0 && progress.timemark) {
            const currentTime = this.parseTimeToSeconds(progress.timemark);
            const percentage = Math.min((currentTime / duration) * 100, 100);

            onProgress({
              percentage,
              currentFps: progress.currentFps,
              currentKbps: progress.currentKbps,
            });
          }
        })
        .on('end', () => {
          const result = this.calculateResult(fileInfo, outputPath, startTime);
          if (settings.removeInputFile && !result.alreadyOptimized) {
            deleteFile(fileInfo.path);
            result.inputFileRemoved = true;
          }
          resolve(result);
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  async compressImage(
    fileInfo: FileInfo,
    settings: CompressionSettings,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const outputPath = generateOutputPath(fileInfo.path, settings.advanced);
    const quality = this.getImageQuality(settings.quality);
    const outputFormat = this.getOutputFormat(fileInfo, settings.advanced);
    const outputExt = `.${outputFormat}`;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(fileInfo.path);
      const outputOptions: string[] = [];

      // Handle different output formats with quality settings
      if (outputExt === '.jpg' || outputExt === '.jpeg') {
        // For target size, we need to adjust quality
        if (settings.advanced?.targetSize) {
          // Estimate quality based on target size ratio
          const ratio = settings.advanced.targetSize / fileInfo.size;
          const adjustedQuality = Math.max(2, Math.min(31, Math.floor(31 * (1 - ratio))));
          outputOptions.push(`-q:v ${adjustedQuality}`);
        } else {
          outputOptions.push(`-q:v ${settings.imageQuality || quality}`);
        }
      } else if (outputExt === '.png') {
        outputOptions.push('-compression_level 9');
      } else if (outputExt === '.webp') {
        if (settings.advanced?.targetSize) {
          const ratio = settings.advanced.targetSize / fileInfo.size;
          const webpQuality = Math.max(1, Math.min(100, Math.floor(ratio * 100)));
          outputOptions.push(`-quality ${webpQuality}`);
        } else {
          outputOptions.push(`-quality ${85 - quality * 5}`);
        }
      } else if (outputExt === '.gif') {
        // GIF optimization
        outputOptions.push('-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse');
      }

      if (outputOptions.length > 0) {
        command.outputOptions(outputOptions);
      }

      command
        .on('start', () => onProgress({ percentage: 10 }))
        .on('progress', () => onProgress({ percentage: 70 }))
        .on('end', () => {
          onProgress({ percentage: 100 });
          const result = this.calculateResult(fileInfo, outputPath, startTime);
          if (settings.removeInputFile && !result.alreadyOptimized) {
            deleteFile(fileInfo.path);
            result.inputFileRemoved = true;
          }
          resolve(result);
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Get audio duration in seconds
  private getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  async compressAudio(
    fileInfo: FileInfo,
    settings: CompressionSettings,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const outputPath = generateOutputPath(fileInfo.path, settings.advanced);
    const { bitrate } = this.getAudioSettings(settings.quality);
    const outputFormat = this.getOutputFormat(fileInfo, settings.advanced);
    const codec = this.getAudioCodec(outputFormat);

    // Check if we need target size encoding
    if (settings.advanced?.targetSize) {
      return this.compressAudioWithTargetSize(
        fileInfo,
        settings,
        outputPath,
        startTime,
        onProgress
      );
    }

    return new Promise(async (resolve, reject) => {
      let duration = 0;

      try {
        duration = await this.getAudioDuration(fileInfo.path);
      } catch {
        // Continue without duration for progress tracking
      }

      const command = ffmpeg(fileInfo.path);
      const outputOptions: string[] = [];

      // Set audio codec
      outputOptions.push(`-c:a ${codec}`);

      // Set bitrate based on format and quality
      // FLAC and WAV are lossless, so we don't set bitrate
      if (outputFormat !== 'flac' && outputFormat !== 'wav') {
        outputOptions.push(`-b:a ${bitrate}k`);
      }

      // Format-specific options
      if (outputFormat === 'ogg') {
        // Vorbis quality setting (0-10)
        const vorbisQuality = settings.quality === 'high' ? 8 : settings.quality === 'medium' ? 5 : 3;
        outputOptions.push(`-q:a ${vorbisQuality}`);
      }

      command
        .outputOptions(outputOptions)
        .on('progress', (progress) => {
          if (duration > 0 && progress.timemark) {
            const currentTime = this.parseTimeToSeconds(progress.timemark);
            const percentage = Math.min((currentTime / duration) * 100, 100);

            onProgress({
              percentage,
              currentKbps: progress.currentKbps,
            });
          }
        })
        .on('end', () => {
          const result = this.calculateResult(fileInfo, outputPath, startTime);
          if (settings.removeInputFile && !result.alreadyOptimized) {
            deleteFile(fileInfo.path);
            result.inputFileRemoved = true;
          }
          resolve(result);
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Audio compression with target file size
  private async compressAudioWithTargetSize(
    fileInfo: FileInfo,
    settings: CompressionSettings,
    outputPath: string,
    startTime: number,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const targetSize = settings.advanced!.targetSize!;
    const duration = await this.getAudioDuration(fileInfo.path);
    const outputFormat = this.getOutputFormat(fileInfo, settings.advanced);
    const codec = this.getAudioCodec(outputFormat);

    // Calculate target bitrate: (target bytes * 8) / duration in seconds / 1000 = kbps
    const targetBitrate = Math.max(32, Math.floor((targetSize * 8) / duration / 1000));

    return new Promise((resolve, reject) => {
      const command = ffmpeg(fileInfo.path);
      const outputOptions: string[] = [];

      outputOptions.push(`-c:a ${codec}`);

      // For lossless formats, we can't target a specific size
      if (outputFormat === 'flac' || outputFormat === 'wav') {
        // Fall back to standard compression
        return this.compressAudio(fileInfo, settings, onProgress).then(resolve).catch(reject);
      }

      outputOptions.push(`-b:a ${targetBitrate}k`);

      command
        .outputOptions(outputOptions)
        .on('progress', (progress) => {
          if (duration > 0 && progress.timemark) {
            const currentTime = this.parseTimeToSeconds(progress.timemark);
            const percentage = Math.min((currentTime / duration) * 100, 100);

            onProgress({
              percentage,
              currentKbps: progress.currentKbps,
            });
          }
        })
        .on('end', () => {
          const result = this.calculateResult(fileInfo, outputPath, startTime);
          if (settings.removeInputFile && !result.alreadyOptimized) {
            deleteFile(fileInfo.path);
            result.inputFileRemoved = true;
          }
          resolve(result);
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  async compress(
    fileInfo: FileInfo,
    settings: CompressionSettings,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    if (fileInfo.type === 'video') {
      return this.compressVideo(fileInfo, settings, onProgress);
    } else if (fileInfo.type === 'audio') {
      return this.compressAudio(fileInfo, settings, onProgress);
    } else {
      return this.compressImage(fileInfo, settings, onProgress);
    }
  }
}
