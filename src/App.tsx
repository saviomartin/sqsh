import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, Static } from 'ink';
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
  BatchFileList,
  BatchProgress,
  BatchSummary,
} from './components.js';
import { CompressionService } from './services/compression.js';
import { formatBytes, bytesToUnit, getFileSizeUnit, calculateTotalSize } from './utils.js';
import {
  AppStep,
  QualityLevel,
  CompressionSettings,
  AdvancedSettings,
  BatchFileInfo,
} from './types.js';

const THANK_YOU_MESSAGE = 'Thank you for using Sqsh. Just type "sqsh" next time to compress any file.';

export const App: React.FC = () => {
  useApp(); // Keep the hook to ensure proper Ink lifecycle
  const [step, setStep] = useState<AppStep>('file-input');
  const [files, setFiles] = useState<BatchFileInfo[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [quality, setQuality] = useState<QualityLevel | null>(null);
  const [removeInputFile, setRemoveInputFile] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings | null>(null);
  const [error, setError] = useState<{ title: string; message: string; instruction?: string } | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [exitWarning, setExitWarning] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // Helper to check if batch mode (more than 1 file)
  const isBatchMode = files.length > 1;
  // Get first file for settings that need a single FileInfo
  const primaryFile = files.length > 0 ? files[0] : null;

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

  const handleFilesSelected = (selectedFiles: BatchFileInfo[]) => {
    setFiles(selectedFiles);
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

  // Update a specific file in the batch
  const updateFile = useCallback((index: number, updates: Partial<BatchFileInfo>) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  }, []);

  // Process a single file in the batch
  const processFile = useCallback(async (
    fileIndex: number,
    compressionService: CompressionService,
    settings: CompressionSettings
  ): Promise<void> => {
    const file = files[fileIndex];
    if (!file) return;

    // Mark file as compressing
    updateFile(fileIndex, { status: 'compressing', progress: 0 });

    try {
      const result = await compressionService.compress(
        file,
        settings,
        (progressInfo) => {
          updateFile(fileIndex, { progress: progressInfo.percentage });
        }
      );

      // Mark file as completed with result
      updateFile(fileIndex, {
        status: 'completed',
        progress: 100,
        result,
      });
    } catch (err) {
      // Mark file as error but continue with next
      updateFile(fileIndex, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Compression failed',
      });
    }
  }, [files, updateFile]);

  const startCompression = async (advanced?: AdvancedSettings) => {
    setStep('compressing');
    setStartTime(Date.now());
    setCurrentFileIndex(0);

    if (files.length === 0 || !quality) return;

    const compressionService = new CompressionService();
    const settings: CompressionSettings = {
      quality: quality,
      removeInputFile: removeInputFile,
      advanced: advanced || advancedSettings || undefined,
    };

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      await processFile(i, compressionService, settings);
    }

    // All files processed
    setStep('compress-more');
  };

  const handleCompressMore = () => {
    // Reset state for new compression
    setFiles([]);
    setCurrentFileIndex(0);
    setQuality(null);
    setRemoveInputFile(false);
    setAdvancedSettings(null);
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

  // Show error if FFmpeg is not installed (no files selected yet)
  if (error && files.length === 0) {
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

  // Get first file's result for single-file mode
  const singleResult = files.length === 1 && files[0].result ? files[0].result : null;
  const totalSize = calculateTotalSize(files);

  /**
   * IMPORTANT: Preventing Excessive Line Breaks Bug
   * 
   * This component uses conditional rendering with <Box marginTop={1} /> spacers.
   * Each spacer Box MUST be inside a conditional that ensures it only renders when needed.
   * 
   * WARNING: If a parent conditional renders but a child Text component doesn't,
   * you'll get empty Box spacers that create blank lines in the terminal.
   * 
   * Rules to prevent the bug:
   * 1. Always wrap spacer Box + content in the SAME fragment
   * 2. Ensure ALL data required for rendering exists in the condition
   * 3. Check that nested conditionals don't create empty renders
   * 4. Test edge cases like: no files, no quality, no settings
   */
  return (
    <Box flexDirection="column">
      <Static items={[{ id: 'welcome' }]}>
        {(item) => <Welcome key={item.id} />}
      </Static>

      {/* Show selected files summary - IMPORTANT: Only show when files selected AND past file-input step */}
      {files.length > 0 && step !== 'file-input' && (
        <>
          <Box marginTop={1} />
          <Text>
            <Text color="green">✓</Text>
            <Text> Selected: </Text>
            {isBatchMode ? (
              <>
                <Text color="cyan">{files.length} files</Text>
                <Text color="#999999"> ({formatBytes(totalSize)} total - {primaryFile?.type}s)</Text>
              </>
            ) : primaryFile && (
              <>
                <Text color="cyan">{primaryFile.name}</Text>
                <Text color="#999999"> ({formatBytes(primaryFile.size)} - {primaryFile.type.charAt(0).toUpperCase() + primaryFile.type.slice(1)})</Text>
              </>
            )}
          </Text>
        </>
      )}

      {/* Show quality selection - IMPORTANT: Only show when quality is set AND past quality-select step */}
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

      {/* Show remove input selection - IMPORTANT: Only show when past remove-input-prompt step */}
      {step !== 'file-input' && step !== 'quality-select' && step !== 'remove-input-prompt' && (
        <>
          <Box marginTop={1} />
          <Text>
            <Text color="green">✓</Text>
            <Text> Remove original{isBatchMode ? 's' : ''}: </Text>
            <Text color="cyan">{removeInputFile ? 'Yes' : 'No'}</Text>
          </Text>
        </>
      )}

      {/* Show advanced settings summary - IMPORTANT: Each setting conditionally rendered to avoid empty boxes */}
      {advancedSettings && step !== 'advanced-settings' && step !== 'advanced-settings-prompt' && (
        <>
          {/* Only render output folder line if it exists */}
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
          {/* Only render target size line if it exists and primaryFile is available */}
          {advancedSettings.targetSize && primaryFile && (
            <>
              <Box marginTop={1} />
              <Text>
                <Text color="green">✓</Text>
                <Text> Target size: </Text>
                <Text color="cyan">
                  {bytesToUnit(advancedSettings.targetSize, getFileSizeUnit(primaryFile.size))} {getFileSizeUnit(primaryFile.size)}
                </Text>
              </Text>
            </>
          )}
          {/* Only render output format line if it exists */}
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

      {/* Step-based component rendering - IMPORTANT: Only ONE of these should render at a time */}
      {step === 'file-input' && <FileDropper onFilesSelected={handleFilesSelected} />}

      {step === 'quality-select' && primaryFile && (
        <QualitySelect fileInfo={primaryFile} onSelect={handleQualitySelected} />
      )}

      {step === 'remove-input-prompt' && (
        <RemoveInputPrompt onSelect={handleRemoveInputSelected} />
      )}

      {step === 'advanced-settings-prompt' && (
        <AdvancedSettingsPrompt onSelect={handleAdvancedSettingsPrompt} />
      )}

      {step === 'advanced-settings' && primaryFile && (
        <AdvancedSettingsEditor fileInfo={primaryFile} onComplete={handleAdvancedSettingsComplete} />
      )}

      {/* Batch mode compression view - IMPORTANT: Only renders during 'compressing' step in batch mode */}
      {step === 'compressing' && isBatchMode && (
        <>
          <BatchFileList files={files} currentIndex={currentFileIndex} />
          <BatchProgress files={files} currentIndex={currentFileIndex} startTime={startTime} />
        </>
      )}

      {/* Single file compression view - IMPORTANT: Only renders during 'compressing' step in single-file mode */}
      {step === 'compressing' && !isBatchMode && primaryFile && (
        <>
          <Box marginTop={1} />
          <Progress
            percentage={files[0]?.progress || 0}
            fileName={primaryFile.name}
            startTime={startTime}
          />
        </>
      )}

      {/* Batch mode results - IMPORTANT: Only renders after compression complete in batch mode */}
      {step === 'compress-more' && isBatchMode && (
        <>
          <BatchSummary files={files} startTime={startTime} />
          <CompressMore onConfirm={handleCompressMore} onCancel={handleExit} />
        </>
      )}

      {/* Single file results - IMPORTANT: Only renders after compression complete in single-file mode */}
      {step === 'compress-more' && !isBatchMode && singleResult && (
        <>
          <Summary result={singleResult} />
          <CompressMore onConfirm={handleCompressMore} onCancel={handleExit} />
        </>
      )}

      {error && files.length > 0 && (
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
