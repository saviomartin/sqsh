import fs from 'fs';
import path from 'path';
import { FileInfo, FileType } from '../types.js';

const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

export function getFileInfo(filePath: string): FileInfo | null {
  try {
    // Clean the file path (remove quotes, trim whitespace)
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
    };
  } catch (error) {
    return null;
  }
}

export function isSupportedFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_VIDEO_FORMATS.includes(ext) || SUPPORTED_IMAGE_FORMATS.includes(ext);
}

export function generateOutputPath(inputPath: string): string {
  const ext = path.extname(inputPath);
  const dir = path.dirname(inputPath);
  const basename = path.basename(inputPath, ext);

  return path.join(dir, `${basename}-compressed${ext}`);
}

export function getSupportedFormats(): string {
  return [...SUPPORTED_VIDEO_FORMATS, ...SUPPORTED_IMAGE_FORMATS]
    .map(ext => ext.replace('.', ''))
    .join(', ');
}
