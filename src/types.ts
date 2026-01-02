export type QualityLevel = 'high' | 'medium' | 'low' | 'custom';

export type FileType = 'video' | 'image' | 'audio';

// Supported output formats
export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi';
export type ImageFormat = 'jpg' | 'png' | 'webp' | 'gif';
export type AudioFormat = 'mp3' | 'aac' | 'wav' | 'ogg' | 'flac' | 'm4a';
export type OutputFormat = VideoFormat | ImageFormat | AudioFormat;

export interface QualityOption {
  label: string;
  value: QualityLevel;
}

export interface AdvancedSettings {
  outputFolder: string | null;  // null means same as input
  targetSize: number | null;    // in bytes, null means no target
  targetSizeUnit: 'KB' | 'MB';  // display unit
  outputFormat: OutputFormat | null;  // null means same as input
}

export interface CompressionSettings {
  quality: QualityLevel;
  crf?: number;
  imageQuality?: number;
  removeInputFile?: boolean;
  advanced?: AdvancedSettings;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: FileType;
  extension: string;
}

export interface CompressionResult {
  inputPath: string;
  outputPath: string;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercentage: number;
  duration: number;
  inputFileRemoved?: boolean;
  alreadyOptimized?: boolean; // True if compression didn't reduce size (output file deleted)
}

export interface ProgressInfo {
  percentage: number;
  elapsed: number;
  estimated?: number;
}

export type AppStep =
  | 'welcome'
  | 'file-input'
  | 'quality-select'
  | 'remove-input-prompt'
  | 'advanced-settings-prompt'
  | 'advanced-settings'
  | 'compressing'
  | 'summary'
  | 'compress-more';
