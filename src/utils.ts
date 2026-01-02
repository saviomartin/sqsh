import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { FileInfo, FileType, QualityLevel, VideoFormat, ImageFormat, OutputFormat, AdvancedSettings } from './types.js';

// Format utilities
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Determine if file size should be displayed in KB or MB
export function getFileSizeUnit(bytes: number): 'KB' | 'MB' {
  const MB = 1024 * 1024;
  return bytes < MB ? 'KB' : 'MB';
}

// Convert bytes to the appropriate unit value
export function bytesToUnit(bytes: number, unit: 'KB' | 'MB'): number {
  if (unit === 'KB') {
    return Math.round(bytes / 1024);
  }
  return Math.round((bytes / (1024 * 1024)) * 100) / 100; // 2 decimal places for MB
}

// Convert unit value back to bytes
export function unitToBytes(value: number, unit: 'KB' | 'MB'): number {
  if (unit === 'KB') {
    return value * 1024;
  }
  return value * 1024 * 1024;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

// FFmpeg utilities
export function checkFFmpegInstalled(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

export function getFFmpegInstallInstructions(): string {
  const platform = process.platform;

  switch (platform) {
    case 'darwin':
      return 'brew install ffmpeg';
    case 'linux':
      return 'sudo apt-get install ffmpeg  (or)  sudo yum install ffmpeg';
    case 'win32':
      return 'Download from https://ffmpeg.org/download.html';
    default:
      return 'Visit https://ffmpeg.org/download.html';
  }
}

// File utilities
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

export function getFileInfo(filePath: string): FileInfo | null {
  try {
    const cleanPath = filePath.trim().replace(/^["']|["']$/g, '');

    if (!fs.existsSync(cleanPath)) {
      return null;
    }

    const stats = fs.statSync(cleanPath);

    if (!stats.isFile()) {
      return null;
    }

    const ext = path.extname(cleanPath).toLowerCase();
    const name = path.basename(cleanPath);

    let type: FileType | null = null;

    if (SUPPORTED_VIDEO_FORMATS.includes(ext)) {
      type = 'video';
    } else if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
      type = 'image';
    }

    if (!type) {
      return null;
    }

    return {
      path: cleanPath,
      name,
      size: stats.size,
      type,
      extension: ext.slice(1), // Remove the dot
    };
  } catch (error) {
    return null;
  }
}

export function isSupportedFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_VIDEO_FORMATS.includes(ext) || SUPPORTED_IMAGE_FORMATS.includes(ext);
}

export function generateOutputPath(inputPath: string, advanced?: AdvancedSettings): string {
  const ext = path.extname(inputPath);
  const dir = advanced?.outputFolder || path.dirname(inputPath);
  const basename = path.basename(inputPath, ext);

  // Use custom format or keep original
  const outputExt = advanced?.outputFormat ? `.${advanced.outputFormat}` : ext;

  // Base output name with -sqshed suffix
  const baseOutputName = `${basename}-sqshed`;
  let outputPath = path.join(dir, `${baseOutputName}${outputExt}`);

  // Check for existing files and add incrementing suffix if needed
  let counter = 1;
  while (fs.existsSync(outputPath)) {
    outputPath = path.join(dir, `${baseOutputName}-${counter}${outputExt}`);
    counter++;
  }

  return outputPath;
}

// Validate if a directory exists
export function isValidDirectory(dirPath: string): boolean {
  try {
    const cleanPath = dirPath.trim().replace(/^["']|["']$/g, '');
    return fs.existsSync(cleanPath) && fs.statSync(cleanPath).isDirectory();
  } catch {
    return false;
  }
}

export function getSupportedFormats(): string {
  return [...SUPPORTED_VIDEO_FORMATS, ...SUPPORTED_IMAGE_FORMATS]
    .map(ext => ext.replace('.', ''))
    .join(', ');
}

// Get available output formats based on file type
export function getVideoFormatOptions(): { value: VideoFormat; label: string; description: string }[] {
  return [
    { value: 'mp4', label: 'MP4', description: 'Most compatible, great for sharing' },
    { value: 'webm', label: 'WebM', description: 'Web-optimized, smaller size' },
    { value: 'mov', label: 'MOV', description: 'Apple QuickTime format' },
    { value: 'mkv', label: 'MKV', description: 'High quality, supports many codecs' },
    { value: 'avi', label: 'AVI', description: 'Legacy format, wide compatibility' },
  ];
}

export function getImageFormatOptions(): { value: ImageFormat; label: string; description: string }[] {
  return [
    { value: 'jpg', label: 'JPG', description: 'Best for photos, lossy compression' },
    { value: 'png', label: 'PNG', description: 'Lossless, supports transparency' },
    { value: 'webp', label: 'WebP', description: 'Modern format, excellent compression' },
    { value: 'gif', label: 'GIF', description: 'Animated images, limited colors' },
  ];
}

export function getFormatOptions(fileType: FileType): { value: OutputFormat; label: string; description: string }[] {
  if (fileType === 'video') {
    return getVideoFormatOptions();
  }
  return getImageFormatOptions();
}

// Delete a file safely
export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// File size prediction based on quality level
export function estimateCompressedSize(originalSize: number, quality: QualityLevel, fileType: FileType): number {
  // Estimation ratios based on typical compression results
  let compressionRatio: number;
  
  if (fileType === 'video') {
    // Video compression estimates based on CRF values
    switch (quality) {
      case 'high':
        // CRF 23: ~85-90% of original size
        compressionRatio = 0.875;
        break;
      case 'medium':
        // CRF 28: ~60-70% of original size
        compressionRatio = 0.65;
        break;
      case 'low':
        // CRF 32: ~40-50% of original size
        compressionRatio = 0.45;
        break;
      default:
        compressionRatio = 0.65;
    }
  } else {
    // Image compression estimates
    switch (quality) {
      case 'high':
        // ~80-90% of original size
        compressionRatio = 0.85;
        break;
      case 'medium':
        // ~50-60% of original size
        compressionRatio = 0.55;
        break;
      case 'low':
        // ~30-40% of original size
        compressionRatio = 0.35;
        break;
      default:
        compressionRatio = 0.55;
    }
  }
  
  return Math.round(originalSize * compressionRatio);
}

