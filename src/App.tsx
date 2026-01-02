import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { Welcome } from './components/Welcome.js';
import { FileDropper } from './components/FileDropper.js';
import { QualitySelect } from './components/QualitySelect.js';
import { Progress } from './components/Progress.js';
import { Summary } from './components/Summary.js';
import { CompressMore } from './components/CompressMore.js';
import { ErrorBox } from './components/ErrorBox.js';
import { CompressionService } from './services/compression.js';
import { checkFFmpegInstalled, getFFmpegInstallInstructions } from './utils/ffmpegCheck.js';
import {
  AppStep,
  FileInfo,
  QualityLevel,
  CompressionResult,
  CompressionSettings,
} from './types.js';
import { formatBytes } from './utils/formatBytes.js';

export const App: React.FC = () => {
  const { exit } = useApp();
  const [step, setStep] = useState<AppStep>('file-input');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [quality, setQuality] = useState<QualityLevel | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<{ title: string; message: string; instruction?: string } | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [exitWarning, setExitWarning] = useState(false);

  // Check FFmpeg on mount
  useEffect(() => {
    if (!checkFFmpegInstalled()) {
      setError({
        title: 'FFmpeg Not Found',
        message: 'FFmpeg is required to compress media files.',
        instruction: `Install it using: ${getFFmpegInstallInstructions()}`,
      });
    }
  }, []);

  // Handle Ctrl+C gracefully with double-press confirmation
  useEffect(() => {
    let warningTimeout: NodeJS.Timeout;

    const handleExit = () => {
      if (exitWarning) {
        // Second Ctrl+C - actually exit
        exit();
      } else {
        // First Ctrl+C - show warning
        setExitWarning(true);

        // Reset warning after 3 seconds
        warningTimeout = setTimeout(() => {
          setExitWarning(false);
        }, 3000);
      }
    };

    process.on('SIGINT', handleExit);
    return () => {
      process.off('SIGINT', handleExit);
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [exit, exitWarning]);

  const handleFileSelected = (file: FileInfo) => {
    setFileInfo(file);
    setStep('quality-select');
  };

  const handleQualitySelected = async (selectedQuality: QualityLevel) => {
    setQuality(selectedQuality);
    setStep('compressing');
    setStartTime(Date.now());

    if (!fileInfo) return;

    try {
      const compressionService = new CompressionService();
      const settings: CompressionSettings = {
        quality: selectedQuality,
      };

      const compressionResult = await compressionService.compress(
        fileInfo,
        settings,
        (progressInfo) => {
          setProgress(progressInfo.percentage);
        }
      );

      setResult(compressionResult);
      setStep('compress-more');
    } catch (err) {
      setError({
        title: 'Compression Failed',
        message: err instanceof Error ? err.message : 'An unknown error occurred',
        instruction: 'Please check the file and try again.',
      });
    }
  };

  const handleCompressMore = () => {
    // Reset state for new compression
    setFileInfo(null);
    setQuality(null);
    setProgress(0);
    setResult(null);
    setError(null);
    setStep('file-input');
  };

  const handleExit = () => {
    exit();
  };

  // Show error if FFmpeg is not installed
  if (error && !fileInfo) {
    return <ErrorBox title={error.title} message={error.message} instruction={error.instruction} />;
  }

  return (
    <Box flexDirection="column">
      <Welcome />

      {fileInfo && step !== 'file-input' && (
        <>
          <Text>
            <Text color="green">✓</Text>
            <Text> Selected: </Text>
            <Text color="cyan">{fileInfo.name}</Text>
            <Text color="#666666"> ({formatBytes(fileInfo.size)})</Text>
          </Text>
          <Box marginTop={1} />
        </>
      )}

      {quality && step !== 'quality-select' && step !== 'file-input' && (
        <Text>
          <Text color="green">✓</Text>
          <Text> Quality: </Text>
          <Text color="cyan">
            {quality.charAt(0).toUpperCase() + quality.slice(1)}
          </Text>
        </Text>
      )}

      {step === 'file-input' && <FileDropper onFileSelected={handleFileSelected} />}

      {step === 'quality-select' && <QualitySelect onSelect={handleQualitySelected} />}

      {step === 'compressing' && fileInfo && (
        <Progress percentage={progress} fileName={fileInfo.name} startTime={startTime} />
      )}

      {step === 'compress-more' && result && (
        <>
          <Summary result={result} />
          <CompressMore onConfirm={handleCompressMore} onCancel={handleExit} />
        </>
      )}

      {error && fileInfo && (
        <Box marginTop={1}>
          <ErrorBox title={error.title} message={error.message} instruction={error.instruction} />
        </Box>
      )}

      {exitWarning && (
        <Box marginTop={1}>
          <Text color="yellow">⚠️  Press Ctrl+C again to exit</Text>
        </Box>
      )}
    </Box>
  );
};
