import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import {
  CompressionSettings,
  CompressionResult,
  FileInfo,
  QualityLevel,
} from '../types.js';
import { generateOutputPath } from '../utils/fileUtils.js';

interface CompressionProgress {
  percentage: number;
  currentFps?: number;
  currentKbps?: number;
}

export class CompressionService {
  private getVideoSettings(quality: QualityLevel): { crf: number; preset: string } {
    switch (quality) {
      case 'high':
        return { crf: 23, preset: 'medium' };
      case 'medium':
        return { crf: 28, preset: 'medium' };
      case 'low':
        return { crf: 32, preset: 'fast' };
      default:
        return { crf: 28, preset: 'medium' };
    }
  }

  private getImageQuality(quality: QualityLevel): number {
    switch (quality) {
      case 'high':
        return 2; // FFmpeg qscale for JPEG (2 = ~85%)
      case 'medium':
        return 5; // ~60%
      case 'low':
        return 10; // ~35%
      default:
        return 5;
    }
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
          // Get duration in seconds
          const timeParts = data.duration.split(':');
          duration =
            parseInt(timeParts[0]) * 3600 +
            parseInt(timeParts[1]) * 60 +
            parseFloat(timeParts[2]);
        })
        .on('progress', (progress) => {
          if (duration > 0 && progress.timemark) {
            const timeParts = progress.timemark.split(':');
            const currentTime =
              parseInt(timeParts[0]) * 3600 +
              parseInt(timeParts[1]) * 60 +
              parseFloat(timeParts[2]);

            const percentage = Math.min((currentTime / duration) * 100, 100);

            onProgress({
              percentage,
              currentFps: progress.currentFps,
              currentKbps: progress.currentKbps,
            });
          }
        })
        .on('end', () => {
          const outputSize = fs.statSync(outputPath).size;
          const savedBytes = fileInfo.size - outputSize;
          const savedPercentage = (savedBytes / fileInfo.size) * 100;
          const durationSeconds = (Date.now() - startTime) / 1000;

          resolve({
            inputPath: fileInfo.path,
            outputPath,
            inputSize: fileInfo.size,
            outputSize,
            savedBytes,
            savedPercentage,
            duration: durationSeconds,
          });
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
      onProgress({ percentage: 10 });

      const command = ffmpeg(fileInfo.path);

      // Handle different image formats
      if (ext === '.jpg' || ext === '.jpeg') {
        command.outputOptions([`-q:v ${settings.imageQuality || quality}`]);
      } else if (ext === '.png') {
        command.outputOptions(['-compression_level 9']);
      } else if (ext === '.webp') {
        command.outputOptions([`-quality ${85 - quality * 5}`]);
      }

      onProgress({ percentage: 50 });

      command
        .on('start', () => {
          onProgress({ percentage: 30 });
        })
        .on('progress', () => {
          onProgress({ percentage: 70 });
        })
        .on('end', () => {
          onProgress({ percentage: 100 });

          const outputSize = fs.statSync(outputPath).size;
          const savedBytes = fileInfo.size - outputSize;
          const savedPercentage = (savedBytes / fileInfo.size) * 100;
          const durationSeconds = (Date.now() - startTime) / 1000;

          resolve({
            inputPath: fileInfo.path,
            outputPath,
            inputSize: fileInfo.size,
            outputSize,
            savedBytes,
            savedPercentage,
            duration: durationSeconds,
          });
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
