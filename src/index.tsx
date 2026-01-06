#!/usr/bin/env node

import React, { useState } from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { Setup } from './Setup.js';
import { AutoCompress } from './AutoCompress.js';
import { checkFFmpegInstalled } from './utils.js';

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Sqsh - Fast media compression for your terminal

Usage:
  sqsh                  Start the interactive CLI
  sqsh auto <file>      Quick compress a single file (medium quality, no questions)
  sqsh setup            Run setup manually
  sqsh setup --force    Run setup flow even if FFmpeg is installed
  sqsh --help           Show this help message
  sqsh --version        Show version number

Supported formats:
  Videos: mp4, mov, avi, mkv, webm, flv, wmv, m4v
  Images: jpg, jpeg, png, gif, webp, bmp

Requirements:
  - FFmpeg must be installed on your system
  - Install via: brew install ffmpeg (macOS)
             or: sudo apt-get install ffmpeg (Linux)

Examples:
  sqsh                           Start interactive mode
  sqsh auto /path/to/video.mp4   Quick compress with defaults
  `);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('Sqsh v1.0.3');
  process.exit(0);
}

// Main wrapper that handles setup -> app flow
interface MainProps {
  forceSetup?: boolean;
}

const Main: React.FC<MainProps> = ({ forceSetup = false }) => {
  const isFFmpegInstalled = checkFFmpegInstalled();
  const needsSetup = !isFFmpegInstalled || forceSetup;
  const [showApp, setShowApp] = useState(!needsSetup);

  const handleSetupComplete = () => {
    setShowApp(true);
  };

  if (showApp) {
    return <App />;
  }

  return <Setup forceSetup={forceSetup} onComplete={handleSetupComplete} />;
};

// Handle commands
if (args[0] === 'setup') {
  const forceSetup = args.includes('--force') || args.includes('-f');
  render(<Main forceSetup={forceSetup} />);
} else if (args[0] === 'auto') {
  // Auto compress command - quick compression with defaults
  const filePath = args.slice(1).join(' '); // Join in case path has spaces

  if (!filePath) {
    console.log('Usage: sqsh auto <file>');
    console.log('Example: sqsh auto /path/to/video.mp4');
    process.exit(1);
  }

  // Check FFmpeg first
  if (!checkFFmpegInstalled()) {
    console.log('Error: FFmpeg is not installed.');
    console.log('Install via: brew install ffmpeg (macOS) or sudo apt-get install ffmpeg (Linux)');
    process.exit(1);
  }

  render(<AutoCompress filePath={filePath} />);
} else {
  render(<Main />);
}
