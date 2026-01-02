import { execSync } from 'child_process';

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
