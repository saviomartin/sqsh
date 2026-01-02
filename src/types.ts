export type QualityLevel = 'high' | 'medium' | 'low' | 'custom';

export type FileType = 'video' | 'image';

export interface QualityOption {
  label: string;
  value: QualityLevel;
}

export interface CompressionSettings {
  quality: QualityLevel;
  crf?: number;
  imageQuality?: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: FileType;
}

export interface CompressionResult {
  inputPath: string;
  outputPath: string;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercentage: number;
  duration: number;
}

export interface ProgressInfo {
  percentage: number;
  elapsed: number;
  estimated?: number;
}

export type AppStep = 'welcome' | 'file-input' | 'quality-select' | 'compressing' | 'summary' | 'compress-more';
