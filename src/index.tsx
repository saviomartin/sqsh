#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Sqsh - Fast media compression for your terminal

Usage:
  sqsh                  Start the interactive CLI
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
  Simply run 'sqsh' and follow the interactive prompts.
  `);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('Sqsh v1.0.0');
  process.exit(0);
}

// Render the app
render(<App />);
