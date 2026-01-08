# Sqsh

Fast media compression for your terminal. Beautiful, interactive CLI tool powered by FFmpeg.

![Demo GIF](demo.gif)


## Installation

```bash
npm install -g sqsh
```

Then run:

```bash
sqsh
```

## Prerequisites

FFmpeg must be installed:

**macOS:** `brew install ffmpeg`  
**Linux:** `sudo apt-get install ffmpeg`  
**Windows:** Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Features

- 🎨 Clean, minimal terminal UI
- 📹 Video compression (MP4, MOV, AVI, MKV, WebM, etc.)
- 🖼️ Image compression (JPG, PNG, GIF, WebP, BMP)
- 🎵 Audio compression (MP3, AAC, WAV, OGG, FLAC, M4A)
- 🎯 Multiple quality presets
- 📁 Batch processing support
- 🎛️ Advanced settings (target size, format conversion, custom output folder)

## Usage

Simply run `sqsh` and follow the interactive prompts. Compressed files are saved with a `-sqshed` suffix in the same directory (or your chosen output folder). Run `sqsh auto {drop_your_media}` to compress files skipping questions.

## License

MIT
