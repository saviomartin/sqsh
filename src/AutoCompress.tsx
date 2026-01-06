import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { CompressionService } from './services/compression.js';
import { getFileInfo, formatBytes } from './utils.js';
import { CompressionSettings, CompressionResult, FileInfo } from './types.js';
import { Progress, Summary, ErrorBox } from './components.js';

interface AutoCompressProps {
  filePath: string;
}

type AutoStep = 'validating' | 'compressing' | 'done' | 'error';

export const AutoCompress: React.FC<AutoCompressProps> = ({ filePath }) => {
  const { exit } = useApp();
  const [step, setStep] = useState<AutoStep>('validating');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runCompression = async () => {
      // Validate file
      const info = getFileInfo(filePath);
      if (!info) {
        setError(`Invalid file: "${filePath}"\nMake sure the file exists and is a supported format (video, image, or audio).`);
        setStep('error');
        setTimeout(() => exit(), 2000);
        return;
      }

      setFileInfo(info);
      setStep('compressing');
      setStartTime(Date.now());

      // Compression settings: medium quality, keep original, no advanced settings
      const settings: CompressionSettings = {
        quality: 'medium',
        removeInputFile: false,
      };

      const compressionService = new CompressionService();

      try {
        const compressionResult = await compressionService.compress(
          info,
          settings,
          (progressInfo) => {
            setProgress(progressInfo.percentage);
          }
        );

        setResult(compressionResult);
        setStep('done');
        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Compression failed');
        setStep('error');
        setTimeout(() => exit(), 2000);
      }
    };

    runCompression();
  }, [filePath, exit]);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">Sqsh Auto</Text>
        <Text color="gray"> - Quick compress with medium quality</Text>
      </Box>

      {/* File info */}
      {fileInfo && (
        <Box marginBottom={1}>
          <Text>
            <Text color="green">✓</Text>
            <Text> File: </Text>
            <Text color="cyan">{fileInfo.name}</Text>
            <Text color="gray"> ({formatBytes(fileInfo.size)} - {fileInfo.type})</Text>
          </Text>
        </Box>
      )}

      {/* Progress */}
      {step === 'compressing' && fileInfo && (
        <Progress
          percentage={progress}
          fileName={fileInfo.name}
          startTime={startTime}
        />
      )}

      {/* Result */}
      {step === 'done' && result && (
        <Summary result={result} />
      )}

      {/* Error */}
      {step === 'error' && error && (
        <ErrorBox
          title="Compression Failed"
          message={error}
        />
      )}
    </Box>
  );
};
