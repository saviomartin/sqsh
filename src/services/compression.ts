import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import {
  CompressionSettings,
  CompressionResult,
  FileInfo,
  QualityLevel,
} from '../types.js';
import { generateOutputPath } from '../utils.js';

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

  async compressVideo(
    fileInfo: FileInfo,
    settings: CompressionSettings,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const outputPath = generateOutputPath(fileInfo.path);
    const { crf, preset } = this.getVideoSettings(settings.quality);

    return new Promise((resolve, reject) => {
      let duration = 0;

      ffmpeg(fileInfo.path)
        .outputOptions([
          `-c:v libx264`,
          `-crf ${settings.crf || crf}`,
          `-preset ${preset}`,
          `-c:a aac`,
          `-b:a 128k`,
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
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
          resolve(this.calculateResult(fileInfo, outputPath, startTime));
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
    const outputPath = generateOutputPath(fileInfo.path);
    const quality = this.getImageQuality(settings.quality);
    const ext = path.extname(fileInfo.path).toLowerCase();

    return new Promise((resolve, reject) => {
      const command = ffmpeg(fileInfo.path);

      // Handle different image formats
      if (ext === '.jpg' || ext === '.jpeg') {
        command.outputOptions([`-q:v ${settings.imageQuality || quality}`]);
      } else if (ext === '.png') {
        command.outputOptions(['-compression_level 9']);
      } else if (ext === '.webp') {
        command.outputOptions([`-quality ${85 - quality * 5}`]);
      }

      command
        .on('start', () => onProgress({ percentage: 10 }))
        .on('progress', () => onProgress({ percentage: 70 }))
        .on('end', () => {
          onProgress({ percentage: 100 });
          resolve(this.calculateResult(fileInfo, outputPath, startTime));
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
    } else {
      return this.compressImage(fileInfo, settings, onProgress);
    }
  }
}
