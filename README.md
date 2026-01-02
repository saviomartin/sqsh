# Sqsh

> Fast media compression for your terminal

A beautiful, interactive CLI tool for compressing media files using FFmpeg. Built with Ink UI for a clean, minimal terminal experience.

## Features

- 🎨 Clean, minimal terminal UI inspired by Claude Code
- 📹 Video compression (MP4, MOV, AVI, MKV, WebM, etc.)
- 🖼️ Image compression (JPG, PNG, GIF, WebP, BMP)
- ⚡ Fast and efficient FFmpeg-based compression
- 📊 Real-time compression progress with spinner
- 💾 Detailed compression statistics
- 🎯 Multiple quality presets (High, Medium, Low)
- ✨ Progressive output - watch each step complete

## Prerequisites

You must have **FFmpeg** installed on your system:

### macOS
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get install ffmpeg
```

### Linux (Fedora/RHEL)
```bash
sudo yum install ffmpeg
```

### Windows
Download from [ffmpeg.org/download.html](https://ffmpeg.org/download.html)

## Installation

### Global Installation (Recommended)

```bash
npm install -g sqsh
```

Then run:
```bash
sqsh
```

### Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd sqsh

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Or run the built version
npm start
```

## Usage

Simply run the command and follow the interactive prompts:

```bash
sqsh
```

### Step-by-Step Flow

1. **Welcome** - Clean app title and tagline
2. **File Input** - Simple input prompt with cursor
3. **Quality Selection** - Arrow-key navigation menu:
   - **High** - Minimal compression (~80% of original size)
   - **Medium** - Balanced compression (~50% of original size)
   - **Low** - Maximum compression (~25% of original size)
4. **Compression** - Animated spinner with real-time progress and elapsed time
5. **Summary** - Clean output showing results and file location

Each completed step stays visible as you progress, creating a clean log of the process.

#### Example Output

```
Sqsh

> /path/to/video.mp4

✓ Selected: video.mp4 (124.5 MB)
✓ Quality: Medium

⠹ Compressing video.mp4... 47% · 12s

✓ Compressed successfully

  Output: video-compressed.mp4
  Size: 124.5 MB → 62.3 MB (saved 50%)
  Time: 25s
```

### Command Line Options

```bash
sqsh --help       # Show help message
sqsh --version    # Show version number
```

## Supported Formats

### Videos
- MP4
- MOV
- AVI
- MKV
- WebM
- FLV
- WMV
- M4V

### Images
- JPG/JPEG
- PNG
- GIF
- WebP
- BMP

## Compression Settings

### Video Compression
- **High Quality**: CRF 23, preset medium
- **Medium Quality**: CRF 28, preset medium
- **Low Quality**: CRF 32, preset fast

Uses H.264 codec with AAC audio at 128kbps.

### Image Compression
- **High Quality**: ~85% quality
- **Medium Quality**: ~60% quality
- **Low Quality**: ~35% quality

## Output

Compressed files are saved in the same directory as the input file with a `-compressed` suffix:

```
Original: video.mp4
Output:   video-compressed.mp4
```

## Architecture

```
sqsh/
├── src/
│   ├── index.tsx              # Entry point with CLI args
│   ├── App.tsx                # Main app with flow logic
│   ├── types.ts               # TypeScript type definitions
│   ├── components/
│   │   ├── Welcome.tsx        # Welcome screen
│   │   ├── FileDropper.tsx    # File input component
│   │   ├── QualitySelect.tsx  # Quality selection menu
│   │   ├── Progress.tsx       # Compression progress
│   │   ├── Summary.tsx        # Results summary
│   │   └── ErrorBox.tsx       # Error display
│   ├── services/
│   │   └── compression.ts     # FFmpeg compression service
│   └── utils/
│       ├── formatBytes.ts     # Byte formatting utilities
│       ├── fileUtils.ts       # File operations
│       └── ffmpegCheck.ts     # FFmpeg detection
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Ink** - React for interactive CLIs
- **Ink UI** - Beautiful terminal UI components (Select, Spinner)
- **React** - Component architecture
- **TypeScript** - Type safety
- **Fluent-FFmpeg** - FFmpeg wrapper
- **Chalk** - Terminal colors

## Development

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Test Locally
```bash
npm link
sqsh
```

## Publishing to npm

1. Update version in `package.json`
2. Build the project:
   ```bash
   npm run build
   ```
3. Publish:
   ```bash
   npm publish
   ```

## Error Handling

The tool handles various error scenarios:

- ❌ File not found
- ❌ Unsupported file format
- ❌ FFmpeg not installed
- ❌ Compression failures

Each error displays a helpful message with instructions for resolution.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

Inspired by the beautiful terminal UI of Claude Code.
