import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import {
  Welcome,
  FileDropper,
  QualitySelect,
  Progress,
  Summary,
  CompressMore,
  ErrorBox,
  RemoveInputPrompt,
  AdvancedSettingsPrompt,
  AdvancedSettingsEditor,
} from './components.js';
import { CompressionService } from './services/compression.js';
import { formatBytes, bytesToUnit, getFileSizeUnit } from './utils.js';
import {
  AppStep,
  FileInfo,
  QualityLevel,
  CompressionResult,
  CompressionSettings,
  AdvancedSettings,
} from './types.js';

const THANK_YOU_MESSAGE = 'Thank you for using Sqsh. Just type "sqsh" next time to compress any file.';

export const App: React.FC = () => {
  const { exit } = useApp();
  const [step, setStep] = useState<AppStep>('file-input');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [quality, setQuality] = useState<QualityLevel | null>(null);
  const [removeInputFile, setRemoveInputFile] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<{ title: string; message: string; instruction?: string } | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [exitWarning, setExitWarning] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // Handle Ctrl+C gracefully with double-press confirmation
  useEffect(() => {
    let warningTimeout: NodeJS.Timeout;

    const handleSigInt = () => {
      if (exitWarning) {
        // Second Ctrl+C - show thank you and exit
        setShowThankYou(true);
        setTimeout(() => {
          process.exit(0);
        }, 1000);
      } else {
        // First Ctrl+C - show warning
        setExitWarning(true);

        // Reset warning after 3 seconds
        warningTimeout = setTimeout(() => {
          setExitWarning(false);
        }, 3000);
      }
    };

    // Remove all existing SIGINT listeners to prevent default exit
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', handleSigInt);

    return () => {
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [exitWarning]);

  const handleFileSelected = (file: FileInfo) => {
    setFileInfo(file);
    setStep('quality-select');
  };

  const handleQualitySelected = (selectedQuality: QualityLevel) => {
    setQuality(selectedQuality);
    setStep('remove-input-prompt');
  };

  const handleRemoveInputSelected = (remove: boolean) => {
    setRemoveInputFile(remove);
    setStep('advanced-settings-prompt');
  };

  const handleAdvancedSettingsPrompt = (wantAdvanced: boolean) => {
    if (wantAdvanced) {
      setStep('advanced-settings');
    } else {
      // Start compression with default settings
      startCompression();
    }
  };

  const handleAdvancedSettingsComplete = (settings: AdvancedSettings) => {
    setAdvancedSettings(settings);
    startCompression(settings);
  };

  const startCompression = async (advanced?: AdvancedSettings) => {
    setStep('compressing');
    setStartTime(Date.now());

    if (!fileInfo || !quality) return;

    try {
      const compressionService = new CompressionService();
      const settings: CompressionSettings = {
        quality: quality,
        removeInputFile: removeInputFile,
        advanced: advanced || advancedSettings || undefined,
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
    setRemoveInputFile(false);
    setAdvancedSettings(null);
    setProgress(0);
    setResult(null);
    setError(null);
    setStep('file-input');
  };

  const handleExit = () => {
    // Always show thank you message when user chooses to exit
    setShowThankYou(true);
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };

  // Show error if FFmpeg is not installed
  if (error && !fileInfo) {
    return (
      <Box flexDirection="column">
        <ErrorBox title={error.title} message={error.message} instruction={error.instruction} />
        {showThankYou && (
          <Box marginTop={1}>
            <Text color="gray">{THANK_YOU_MESSAGE}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Welcome />

      {fileInfo && step !== 'file-input' && (
        <>
          <Box marginTop={1} />
          <Text>
            <Text color="green">✓</Text>
            <Text> Selected: </Text>
            <Text color="cyan">{fileInfo.name}</Text>
            <Text color="#999999"> ({formatBytes(fileInfo.size)} - {fileInfo.type.charAt(0).toUpperCase() + fileInfo.type.slice(1)})</Text>
          </Text>
        </>
      )}

      {quality && step !== 'quality-select' && step !== 'file-input' && (
        <>
          <Box marginTop={1} />
          <Text>
            <Text color="green">✓</Text>
            <Text> Quality: </Text>
            <Text color="cyan">
              {quality.charAt(0).toUpperCase() + quality.slice(1)}
            </Text>
          </Text>
        </>
      )}

      {/* Show remove input selection */}
      {step !== 'file-input' && step !== 'quality-select' && step !== 'remove-input-prompt' && (
        <>
          <Box marginTop={1} />
          <Text>
            <Text color="green">✓</Text>
            <Text> Remove original: </Text>
            <Text color="cyan">{removeInputFile ? 'Yes' : 'No'}</Text>
          </Text>
        </>
      )}

      {/* Show advanced settings summary - each on its own line */}
      {advancedSettings && step !== 'advanced-settings' && step !== 'advanced-settings-prompt' && (
        <>
          {advancedSettings.outputFolder && (
            <>
              <Box marginTop={1} />
              <Text>
                <Text color="green">✓</Text>
                <Text> Output folder: </Text>
                <Text color="cyan">{advancedSettings.outputFolder}</Text>
              </Text>
            </>
          )}
          {advancedSettings.targetSize && fileInfo && (
            <>
              <Box marginTop={1} />
              <Text>
                <Text color="green">✓</Text>
                <Text> Target size: </Text>
                <Text color="cyan">
                  {bytesToUnit(advancedSettings.targetSize, getFileSizeUnit(fileInfo.size))} {getFileSizeUnit(fileInfo.size)}
                </Text>
              </Text>
            </>
          )}
          {advancedSettings.outputFormat && (
            <>
              <Box marginTop={1} />
              <Text>
                <Text color="green">✓</Text>
                <Text> Output format: </Text>
                <Text color="cyan">.{advancedSettings.outputFormat}</Text>
              </Text>
            </>
          )}
        </>
      )}

      {step === 'file-input' && <FileDropper onFileSelected={handleFileSelected} />}

      {step === 'quality-select' && fileInfo && (
        <QualitySelect fileInfo={fileInfo} onSelect={handleQualitySelected} />
      )}

      {step === 'remove-input-prompt' && (
        <RemoveInputPrompt onSelect={handleRemoveInputSelected} />
      )}

      {step === 'advanced-settings-prompt' && (
        <AdvancedSettingsPrompt onSelect={handleAdvancedSettingsPrompt} />
      )}

      {step === 'advanced-settings' && fileInfo && (
        <AdvancedSettingsEditor fileInfo={fileInfo} onComplete={handleAdvancedSettingsComplete} />
      )}

      {step === 'compressing' && fileInfo && (
        <>
          <Box marginTop={1} />
          <Progress percentage={progress} fileName={fileInfo.name} startTime={startTime} />
        </>
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
          <Text color="yellow">Press Ctrl+C again to exit</Text>
        </Box>
      )}

      {showThankYou && (
        <Box marginTop={1}>
          <Text color="gray">{THANK_YOU_MESSAGE}</Text>
        </Box>
      )}
    </Box>
  );
};
