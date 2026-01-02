import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ConfirmInput, Spinner } from '@inkjs/ui';
import path from 'path';
import stringWidth from 'string-width';
import { QualityLevel, FileInfo, CompressionResult, AdvancedSettings } from './types';
import {
  getFileInfo,
  formatBytes,
  formatDuration,
  estimateCompressedSize,
  getFileSizeUnit,
  bytesToUnit,
  unitToBytes,
  getFormatOptions,
  isValidDirectory,
} from './utils';

// Divider component that extends to full terminal width
const Divider: React.FC = () => {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;
  const dividerLine = '─'.repeat(terminalWidth);
  
  return (
    <Text color="yellow">{dividerLine}</Text>
  );
};

// Welcome component
export const Welcome: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="#ff6b4a">
        Sqsh
      </Text>
      <Text color="#999999">Fast video, image & audio compression for your terminal</Text>
    </Box>
  );
};

// FileDropper component
interface FileDropperProps {
  onFileSelected: (fileInfo: FileInfo) => void;
}

export const FileDropper: React.FC<FileDropperProps> = ({ onFileSelected }) => {
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      // Submit the cleaned path
      const cleanPath = inputValue.trim();
      if (cleanPath) {
        const fileInfo = getFileInfo(cleanPath);
        if (!fileInfo) {
          setError('File not found or unsupported format');
          return;
        }
        onFileSelected(fileInfo);
      }
    } else if (key.backspace || key.delete) {
      // Handle backspace
      setInputValue(prev => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      // Strip quotes from input as user types/pastes (but allow Ctrl/Cmd combinations)
      const cleanInput = input.replace(/["']/g, '');
      setInputValue(prev => prev + cleanInput);
    }
  });

  const displayValue = inputValue.trim().replace(/^["']|["']$/g, '') || '';
  const showPlaceholder = !inputValue;

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Divider />
      </Box>
      <Text color="yellow">📁 Paste file path:</Text>
      <Box marginTop={1}>
        <Text color="#999999">Supports video, image, and audio files (mp4, jpg, mp3, etc.)</Text>
      </Box>
      <Box marginTop={1} flexDirection="row" alignItems="center" paddingX={1} borderStyle="round" borderColor="gray">
        <Text color="white">{'> '}</Text>
        <Box flexGrow={1}>
          {showPlaceholder ? (
            <Text color="#666666">/path/to/your/file</Text>
          ) : (
            <Text color="white">{displayValue}</Text>
          )}
        </Box>
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}
    </Box>
  );
};

// QualitySelect component
interface QualitySelectProps {
  fileInfo: FileInfo;
  onSelect: (quality: QualityLevel) => void;
}

// Quality descriptions by file type
const getQualityDetails = (fileType: string): Record<QualityLevel, { label: string; description: string }> => {
  if (fileType === 'audio') {
    return {
      high: {
        label: 'High',
        description: '320kbps - Near lossless audio quality',
      },
      medium: {
        label: 'Medium',
        description: '192kbps - Good quality, balanced size',
      },
      low: {
        label: 'Low',
        description: '128kbps - Smaller file, acceptable quality',
      },
      custom: {
        label: 'Custom',
        description: 'Custom settings',
      },
    };
  }
  // Default for video and image
  return {
    high: {
      label: 'High',
      description: 'Minimal compression, best quality',
    },
    medium: {
      label: 'Medium',
      description: 'Balanced compression and quality',
    },
    low: {
      label: 'Low',
      description: 'Maximum compression, smaller file size',
    },
    custom: {
      label: 'Custom',
      description: 'Custom settings',
    },
  };
};

export const QualitySelect: React.FC<QualitySelectProps> = ({ fileInfo, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const qualityLevels: QualityLevel[] = ['high', 'medium', 'low'];
  const qualityDetails = getQualityDetails(fileInfo.type);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : qualityLevels.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < qualityLevels.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(qualityLevels[selectedIndex]);
    }
  });

  const getQualityOption = (quality: QualityLevel, index: number) => {
    const isSelected = index === selectedIndex;
    const details = qualityDetails[quality];
    const estimatedSize = estimateCompressedSize(fileInfo.size, quality, fileInfo.type);
    const savedBytes = fileInfo.size - estimatedSize;
    const savedPercentage = ((savedBytes / fileInfo.size) * 100).toFixed(0);

    return (
      <Box key={quality} flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" alignItems="center">
          <Text color={isSelected ? '#a855f7' : 'white'}>
            {isSelected ? '> ' : '  '}
            {index + 1}. {details.label}
          </Text>
        </Box>
        <Box marginLeft={4} flexDirection="column">
          <Text color="#999999">   {details.description}</Text>
          <Text color="#999999">
            {'   '}Estimated size: <Text color="cyan">{formatBytes(estimatedSize)}</Text>
            {' '}(saves <Text color="green">~{savedPercentage}%</Text>)
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Divider />
      </Box>
      <Text color="yellow">⚙️  Select quality:</Text>
      <Box marginTop={1} />
      <Box flexDirection="column">
        {qualityLevels.map((quality, index) => getQualityOption(quality, index))}
      </Box>
      <Box marginTop={1}>
        <Text color="#999999">Enter to confirm · ↑/↓ to navigate</Text>
      </Box>
    </Box>
  );
};

// Progress component
interface ProgressProps {
  percentage: number;
  fileName: string;
  startTime: number;
}

export const Progress: React.FC<ProgressProps> = ({
  percentage,
  fileName,
  startTime,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const label = `Compressing ${fileName}... ${percentage.toFixed(0)}% · ${formatDuration(elapsed)}`;

  return <Spinner label={label} />;
};

// Summary component - Robust and responsive design
interface SummaryProps {
  result: CompressionResult;
}

// Helper to truncate path in the middle if too long
const truncatePath = (filePath: string, maxLength: number): string => {
  if (stringWidth(filePath) <= maxLength) return filePath;

  const fileName = filePath.split('/').pop() || '';
  const dirPath = filePath.slice(0, filePath.length - fileName.length - 1);

  // Always show full filename if possible, truncate directory
  const ellipsis = '...';
  const availableForDir = maxLength - stringWidth(fileName) - stringWidth(ellipsis) - 1; // -1 for /

  if (availableForDir < 10) {
    // Not enough space for dir, truncate filename too
    const halfMax = Math.floor((maxLength - stringWidth(ellipsis)) / 2);
    return filePath.slice(0, halfMax) + ellipsis + filePath.slice(-halfMax);
  }

  // Show start of dir path + ... + filename
  return dirPath.slice(0, availableForDir) + ellipsis + '/' + fileName;
};

// Helper to truncate text if too long
const truncateText = (text: string, maxLength: number): string => {
  if (stringWidth(text) <= maxLength) return text;
  const ellipsis = '...';
  return text.slice(0, maxLength - stringWidth(ellipsis)) + ellipsis;
};

export const Summary: React.FC<SummaryProps> = ({ result }) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;
  const isMacOS = process.platform === 'darwin';
  const clickInstruction = isMacOS ? '⌘+Click' : 'Ctrl+Click';

  // Fixed box width based on terminal - never exceed terminal width
  const boxWidth = Math.min(terminalWidth - 2, 80); // Max 80, or terminal - 2
  const innerWidth = boxWidth - 4; // Space for "│ " and " │"

  // Safe padding helper
  const getPadding = (lineContent: string): string => {
    const padding = innerWidth - stringWidth(lineContent);
    return ' '.repeat(Math.max(0, padding));
  };

  const emptyInner = ' '.repeat(Math.max(0, innerWidth));

  // Handle already optimized files - show special message
  if (result.alreadyOptimized) {
    const fileName = result.inputPath.split('/').pop() || 'file';
    const displayFileName = truncateText(fileName, innerWidth - 10);
    const inputMB = result.inputSize / (1024 * 1024);
    const duration = Math.max(0, result.duration);
    const timeText = duration < 60
      ? `${duration.toFixed(duration < 1 ? 3 : 0)}s`
      : formatDuration(duration);

    const headerTitle = '╭─ Already Optimized ';
    const headerDashes = '─'.repeat(Math.max(0, boxWidth - stringWidth(headerTitle) - 1));
    const topBorder = headerTitle + headerDashes + '╮';
    const bottomBorder = '╰' + '─'.repeat(Math.max(0, boxWidth - 2)) + '╯';

    const line1 = `✨ ${displayFileName}`;
    const line2 = `💾 ${inputMB.toFixed(2)} MB - already at optimal size`;
    const line3 = `⚡ Checked in ${timeText}`;
    const line4 = `📁 No new file created - original preserved`;

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="#fbbf24" bold>{topBorder}</Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text>{emptyInner}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text color="#fbbf24">✨ </Text>
          <Text color="white">{displayFileName}</Text>
          <Text>{getPadding(line1)}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text>{emptyInner}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text color="#60a5fa">💾 </Text>
          <Text color="white">{inputMB.toFixed(2)} MB</Text>
          <Text color="#999999"> - already at optimal size</Text>
          <Text>{getPadding(line2)}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text color="#22c55e">⚡ </Text>
          <Text color="white">Checked in </Text>
          <Text color="#22c55e" bold>{timeText}</Text>
          <Text>{getPadding(line3)}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text>{emptyInner}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text color="#22c55e">📁 </Text>
          <Text color="#999999">No new file created - original preserved</Text>
          <Text>{getPadding(line4)}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text>
          <Text color="#fbbf24">│ </Text>
          <Text>{emptyInner}</Text>
          <Text color="#fbbf24"> │</Text>
        </Text>

        <Text color="#fbbf24" bold>{bottomBorder}</Text>
      </Box>
    );
  }

  // Calculate file sizes with fallbacks
  const savedBytes = Math.abs(result.savedBytes);
  const savedMB = savedBytes / (1024 * 1024);
  const inputMB = result.inputSize / (1024 * 1024);
  const outputMB = result.outputSize / (1024 * 1024);
  const isSmaller = result.savedBytes > 0;

  // Safe file name extraction with fallbacks
  const fileName = result.outputPath.split('/').pop() || 'output';
  const originalFileName = fileName.replace(/-compressed/g, '').replace(/\.[^.]+$/, '') + path.extname(result.outputPath);

  // Time formatting with fallback
  const duration = Math.max(0, result.duration);
  const timeText = duration < 60
    ? `${duration.toFixed(duration < 1 ? 3 : 0)}s`
    : formatDuration(duration);

  // Determine quality loss text based on saved percentage
  const savedPct = Math.abs(result.savedPercentage);
  const qualityText = savedPct < 10
    ? 'with zero quality loss'
    : savedPct < 30
    ? 'with minimal quality loss'
    : 'with optimized quality';

  // Truncate content to fit within box
  const maxContentWidth = innerWidth - 2; // Extra safety margin
  const displayFileName = truncateText(originalFileName, maxContentWidth - 20); // Reserve space for "🎉  → XX% smaller"
  const displayPath = truncatePath(result.outputPath, maxContentWidth - 3); // Reserve space for "📁 "

  // Build content lines for padding calculation (with truncated content)
  const line1 = `🎉 ${displayFileName} → ${savedPct.toFixed(0)}% ${isSmaller ? 'smaller' : 'larger'}`;
  const line2 = `💾 ${inputMB.toFixed(2)} MB  →  ${outputMB.toFixed(2)} MB  (${isSmaller ? 'saved' : 'added'} ${savedMB.toFixed(2)} MB)`;
  const line3 = `⚡ Compressed in ${timeText} ${qualityText}`;
  const line4 = `📁 ${displayPath}`;
  const line5 = `   ${clickInstruction} to reveal in Finder`;

  // Create border lines
  const headerTitle = '╭─ Compression Complete! ';
  const headerDashes = '─'.repeat(Math.max(0, boxWidth - stringWidth(headerTitle) - 1));
  const topBorder = headerTitle + headerDashes + '╮';
  const bottomBorder = '╰' + '─'.repeat(Math.max(0, boxWidth - 2)) + '╯';

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Text color="#ff6b4a" bold>{topBorder}</Text>

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyInner}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Success message with percentage */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#ffd700">🎉 </Text>
        <Text color="white">{displayFileName}</Text>
        <Text color="white"> → </Text>
        <Text color={isSmaller ? '#22c55e' : '#ef4444'} bold>{savedPct.toFixed(0)}% {isSmaller ? 'smaller' : 'larger'}</Text>
        <Text>{getPadding(line1)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyInner}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* File sizes */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#60a5fa">💾 </Text>
        <Text color="white">{inputMB.toFixed(2)} MB</Text>
        <Text color="#999999">  →  </Text>
        <Text color={isSmaller ? '#22c55e' : '#ef4444'} bold>{outputMB.toFixed(2)} MB</Text>
        <Text color="#999999">  ({isSmaller ? 'saved' : 'added'} </Text>
        <Text color="#3b82f6" bold>{savedMB.toFixed(2)} MB</Text>
        <Text color="#999999">)</Text>
        <Text>{getPadding(line2)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Time and quality */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#fbbf24">⚡ </Text>
        <Text color="white">Compressed in </Text>
        <Text color="#fbbf24" bold>{timeText}</Text>
        <Text color="#999999"> {qualityText}</Text>
        <Text>{getPadding(line3)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyInner}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Output path */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#60a5fa">📁 </Text>
        <Text color="cyan">{displayPath}</Text>
        <Text>{getPadding(line4)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Click instruction */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>   </Text>
        <Text color="#999999">{clickInstruction} to reveal in Finder</Text>
        <Text>{getPadding(line5)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyInner}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Footer */}
      <Text color="#ff6b4a" bold>{bottomBorder}</Text>
    </Box>
  );
};

// CompressMore component
interface CompressMoreProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const CompressMore: React.FC<CompressMoreProps> = ({ onConfirm, onCancel }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Divider />
      </Box>
      <Box flexDirection="row" alignItems="center">
        <Text color="yellow">Compress another file? </Text>
        <ConfirmInput onConfirm={onConfirm} onCancel={onCancel} />
      </Box>
    </Box>
  );
};

// RemoveInputPrompt component
interface RemoveInputPromptProps {
  onSelect: (removeInput: boolean) => void;
}

export const RemoveInputPrompt: React.FC<RemoveInputPromptProps> = ({ onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to No
  const options = [
    { label: 'Yes', value: true, description: 'Delete original file after compression' },
    { label: 'No', value: false, description: 'Keep original file (recommended)' },
  ];

  useInput((_input, key) => {
    if (key.upArrow || key.downArrow) {
      setSelectedIndex((prev) => (prev === 0 ? 1 : 0));
    } else if (key.return) {
      onSelect(options[selectedIndex].value);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Divider />
      </Box>
      <Text color="yellow">🗑️  Remove original file after compression?</Text>
      <Box marginTop={1} flexDirection="column">
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={option.label} flexDirection="row" marginBottom={0}>
              <Text color={isSelected ? '#a855f7' : 'white'}>
                {isSelected ? '> ' : '  '}{option.label}
              </Text>
              <Text color="#999999"> - {option.description}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="#999999">Enter to confirm · ↑/↓ to navigate</Text>
      </Box>
    </Box>
  );
};

// AdvancedSettingsPrompt component
interface AdvancedSettingsPromptProps {
  onSelect: (wantAdvanced: boolean) => void;
}

export const AdvancedSettingsPrompt: React.FC<AdvancedSettingsPromptProps> = ({ onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to No
  const options = [
    { label: 'Yes', value: true, description: 'Configure output folder, target size, format' },
    { label: 'No', value: false, description: 'Use default settings' },
  ];

  useInput((_input, key) => {
    if (key.upArrow || key.downArrow) {
      setSelectedIndex((prev) => (prev === 0 ? 1 : 0));
    } else if (key.return) {
      onSelect(options[selectedIndex].value);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Divider />
      </Box>
      <Text color="yellow">⚙️  Edit advanced settings?</Text>
      <Box marginTop={1} flexDirection="column">
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={option.label} flexDirection="row" marginBottom={0}>
              <Text color={isSelected ? '#a855f7' : 'white'}>
                {isSelected ? '> ' : '  '}{option.label}
              </Text>
              <Text color="#999999"> - {option.description}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="#999999">Enter to confirm · ↑/↓ to navigate</Text>
      </Box>
    </Box>
  );
};

// AdvancedSettingsEditor component
type AdvancedStep = 'output-folder' | 'target-size' | 'file-format';

interface AdvancedSettingsEditorProps {
  fileInfo: FileInfo;
  onComplete: (settings: AdvancedSettings) => void;
}

export const AdvancedSettingsEditor: React.FC<AdvancedSettingsEditorProps> = ({
  fileInfo,
  onComplete,
}) => {
  const [step, setStep] = useState<AdvancedStep>('output-folder');
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);

  // Target size state
  const sizeUnit = getFileSizeUnit(fileInfo.size);
  const currentSize = bytesToUnit(fileInfo.size, sizeUnit);
  const [targetSizeInput, setTargetSizeInput] = useState('');
  const [targetSize, setTargetSize] = useState<number | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Format state - default to current format
  const formatOptions = getFormatOptions(fileInfo.type);
  const currentFormatIndex = formatOptions.findIndex(f => f.value === fileInfo.extension);
  const [selectedFormatIndex, setSelectedFormatIndex] = useState(currentFormatIndex >= 0 ? currentFormatIndex : 0);

  const inputDir = path.dirname(fileInfo.path);

  // Output Folder Step
  const handleFolderInput = (input: string, key: any) => {
    if (key.return) {
      const cleanPath = folderInput.trim().replace(/^["']|["']$/g, '');
      if (!cleanPath) {
        // Empty means use default (same as input)
        setOutputFolder(null);
        setStep('target-size');
      } else if (isValidDirectory(cleanPath)) {
        setOutputFolder(cleanPath);
        setStep('target-size');
      } else {
        setFolderError('Invalid directory path');
      }
    } else if (key.backspace || key.delete) {
      setFolderInput(prev => prev.slice(0, -1));
      setFolderError(null);
    } else if (input && !key.ctrl && !key.meta) {
      const cleanInput = input.replace(/["']/g, '');
      setFolderInput(prev => prev + cleanInput);
      setFolderError(null);
    }
  };

  // Target Size Step
  const handleTargetSizeInput = (input: string, key: any) => {
    if (key.return) {
      const value = targetSizeInput.trim();
      if (!value) {
        // Empty means no target size
        setTargetSize(null);
        setStep('file-format');
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
          setSizeError('Please enter a valid positive number');
        } else if (numValue >= currentSize) {
          setSizeError(`Target must be smaller than ${currentSize} ${sizeUnit}`);
        } else {
          setTargetSize(unitToBytes(numValue, sizeUnit));
          setStep('file-format');
        }
      }
    } else if (key.backspace || key.delete) {
      setTargetSizeInput(prev => prev.slice(0, -1));
      setSizeError(null);
    } else if (input && !key.ctrl && !key.meta && /[\d.]/.test(input)) {
      setTargetSizeInput(prev => prev + input);
      setSizeError(null);
    }
  };

  // Format Step
  const handleFormatInput = (_input: string, key: any) => {
    if (key.upArrow) {
      setSelectedFormatIndex(prev => (prev > 0 ? prev - 1 : formatOptions.length - 1));
    } else if (key.downArrow) {
      setSelectedFormatIndex(prev => (prev < formatOptions.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const selectedFormat = formatOptions[selectedFormatIndex].value;
      // If selecting current format, pass null (no conversion needed)
      const outputFormat = selectedFormat === fileInfo.extension ? null : selectedFormat;

      // Complete with all settings
      onComplete({
        outputFolder,
        targetSize,
        targetSizeUnit: sizeUnit,
        outputFormat,
      });
    }
  };

  // Use the appropriate handler based on step
  useInput((input, key) => {
    if (step === 'output-folder') {
      handleFolderInput(input, key);
    } else if (step === 'target-size') {
      handleTargetSizeInput(input, key);
    } else if (step === 'file-format') {
      handleFormatInput(input, key);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Divider />
      </Box>
      <Text color="yellow" bold>⚙️  Advanced Settings</Text>

      {/* Step 1: Output Folder */}
      {step === 'output-folder' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">📁 Output folder:</Text>
          <Box marginTop={1}>
            <Text color="#999999">Drag and drop folder or paste path (Enter to keep same as input)</Text>
          </Box>
          <Box marginTop={1} flexDirection="row" alignItems="center" paddingX={1} borderStyle="round" borderColor="gray">
            <Text color="white">{'> '}</Text>
            <Box flexGrow={1}>
              {!folderInput ? (
                <Text color="#666666">{inputDir}</Text>
              ) : (
                <Text color="white">{folderInput}</Text>
              )}
            </Box>
          </Box>
          {folderError && (
            <Box marginTop={1}>
              <Text color="red">✗ {folderError}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Show completed output folder */}
      {step !== 'output-folder' && (
        <Box marginTop={1}>
          <Text>
            <Text color="green">✓</Text>
            <Text> Output folder: </Text>
            <Text color="cyan">{outputFolder || inputDir}</Text>
          </Text>
        </Box>
      )}

      {/* Step 2: Target Size */}
      {step === 'target-size' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">📊 Target file size ({sizeUnit}):</Text>
          <Box marginTop={1}>
            <Text color="#999999">
              Current size: <Text color="white">{currentSize} {sizeUnit}</Text>
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="row" alignItems="center" paddingX={1} borderStyle="round" borderColor="gray">
            <Text color="white">{'> '}</Text>
            <Box flexGrow={1}>
              {!targetSizeInput ? (
                <Text color="#666666">Press Enter to skip</Text>
              ) : (
                <Text color="white">{targetSizeInput}</Text>
              )}
            </Box>
            <Text color="#999999"> {sizeUnit}</Text>
          </Box>
          {sizeError && (
            <Box marginTop={1}>
              <Text color="red">✗ {sizeError}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Show completed target size */}
      {step === 'file-format' && (
        <Box marginTop={1}>
          <Text>
            <Text color="green">✓</Text>
            <Text> Target size: </Text>
            <Text color="cyan">
              {targetSize
                ? `${bytesToUnit(targetSize, sizeUnit)} ${sizeUnit}`
                : 'Auto (based on quality)'}
            </Text>
          </Text>
        </Box>
      )}

      {/* Step 3: File Format */}
      {step === 'file-format' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">{fileInfo.type === 'audio' ? '🎵' : fileInfo.type === 'video' ? '🎬' : '🖼️'} Output format:</Text>
          <Box marginTop={1} flexDirection="column">
            {formatOptions.map((format, index) => {
              const isSelected = selectedFormatIndex === index;
              const isCurrent = format.value === fileInfo.extension;
              // Highlight: purple if selected, gold if current (not selected), white otherwise
              const labelColor = isSelected ? '#a855f7' : isCurrent ? '#fbbf24' : 'white';
              return (
                <Box key={format.value} flexDirection="row" marginBottom={1}>
                  <Text color={labelColor}>
                    {isSelected ? '> ' : '  '}{index + 1}. {format.label}
                  </Text>
                  {isCurrent ? (
                    <Text color="#fbbf24"> - {format.description} (current)</Text>
                  ) : (
                    <Text color="#999999"> - {format.description}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text color="#999999">Enter to confirm · ↑/↓ to navigate</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ErrorBox component
interface ErrorBoxProps {
  title: string;
  message: string;
  instruction?: string;
}

export const ErrorBox: React.FC<ErrorBoxProps> = ({ title, message, instruction }) => {
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="red">✗ {title}</Text>
      </Text>
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <Text color="white">{message}</Text>
        {instruction && (
          <Box marginTop={1}>
            <Text color="gray">{instruction}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

