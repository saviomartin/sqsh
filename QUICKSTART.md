# Quick Start Guide

Get up and running with compressx in under 2 minutes!

## Step 1: Install FFmpeg

### macOS
```bash
brew install ffmpeg
```

### Linux
```bash
sudo apt-get install ffmpeg
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Run the Development Version

```bash
npm run dev
```

## Step 4: Build for Production

```bash
npm run build
```

## Step 5: Test the Built Version

```bash
npm start
```

## Step 6: Link Globally (Optional)

To use `compressx` command anywhere:

```bash
npm link
```

Now you can run:
```bash
compressx
```

## Publishing to npm

1. Create an npm account at [npmjs.com](https://www.npmjs.com)

2. Login to npm:
   ```bash
   npm login
   ```

3. Update the package name in `package.json` if needed (must be unique on npm)

4. Publish:
   ```bash
   npm publish
   ```

5. Install globally:
   ```bash
   npm install -g compressx
   ```

## Usage Example

1. Run `compressx`
2. Drag and drop a video file (e.g., `video.mp4`)
3. Press Enter
4. Select quality using arrow keys
5. Press Enter to start compression
6. Wait for completion
7. Find compressed file in the same directory as `video-compressed.mp4`

## Troubleshooting

### FFmpeg not found
- Make sure FFmpeg is installed and in your PATH
- Run `ffmpeg -version` to verify

### TypeScript errors
- Run `npm install` to ensure all dependencies are installed
- Check Node version (requires Node 18+)

### Module resolution errors
- Make sure you're using `"type": "module"` in package.json
- All imports must include `.js` extension even for `.ts` files

## Project Structure

```
src/
├── index.tsx          - Entry point, handles CLI args
├── App.tsx            - Main app logic and flow
├── types.ts           - TypeScript definitions
├── components/        - React components for UI
│   ├── Welcome.tsx
│   ├── FileDropper.tsx
│   ├── QualitySelect.tsx
│   ├── Progress.tsx
│   ├── Summary.tsx
│   └── ErrorBox.tsx
├── services/
│   └── compression.ts - FFmpeg compression logic
└── utils/             - Utility functions
    ├── formatBytes.ts
    ├── fileUtils.ts
    └── ffmpegCheck.ts
```

Happy compressing!
