import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ConfirmInput, Spinner } from '@inkjs/ui';
import path from 'path';
import stringWidth from 'string-width';
import { QualityLevel, FileInfo, CompressionResult, AdvancedSettings, BatchFileInfo } from './types';
import {
  getFileInfo,
  getFilesFromFolder,
  isDirectory,
  formatBytes,
  formatDuration,
  estimateCompressedSize,
  getFileSizeUnit,
  bytesToUnit,
  unitToBytes,
  getFormatOptions,
  isValidDirectory,
  validateBatchFiles,
  toBatchFiles,
  calculateTotalSize,
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
  const asciiArt = `                                        
█▀▀▀ █▀▀█ █▀▀▀ █░░█
▀▀▀█ █░░█ ▀▀▀█ █▀▀█
▀▀▀▀ ▀▀▀█ ▀▀▀▀ █░░█`;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="#ff6b4a">
        {asciiArt}
      </Text>
      <Text color="#999999">Fast video, image & audio compression for your terminal</Text>
    </Box>
  );
};

// FileDropper component - single file or folder drop
interface FileDropperProps {
  onFilesSelected: (files: BatchFileInfo[]) => void;
}

export const FileDropper: React.FC<FileDropperProps> = ({ onFilesSelected }) => {
  const [error, setError] = useState<string | null>(null);
  const [droppedFiles, setDroppedFiles] = useState<FileInfo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [folderName, setFolderName] = useState<string | null>(null);

  // Validate files whenever they change
  useEffect(() => {
    if (droppedFiles.length === 0) {
      setError(null);
      return;
    }

    const validation = validateBatchFiles(droppedFiles);
    if (!validation.valid) {
      setError(validation.error || 'Invalid files');
    } else {
      setError(null);
    }
  }, [droppedFiles]);

  // Process a dropped path - could be a file or folder
  const processPath = useCallback((rawPath: string) => {
    const cleanPath = rawPath.trim().replace(/^["']|["']$/g, '');
    if (!cleanPath) return;

    // Check if it's a directory
    if (isDirectory(cleanPath)) {
      const folderFiles = getFilesFromFolder(cleanPath);
      
      if (folderFiles.length === 0) {
        setError('No supported files found in folder');
        return;
      }
      
      // Set all files from the folder
      setDroppedFiles(folderFiles);
      setFolderName(cleanPath.split('/').pop() || 'folder');
      setError(null);
      return;
    }

    // It's a single file
    const fileInfo = getFileInfo(cleanPath);
    if (fileInfo) {
      // Check for duplicates
      setDroppedFiles(prev => {
        if (prev.some(f => f.path === fileInfo.path)) {
          return prev;
        }
        return [...prev, fileInfo];
      });
      setFolderName(null);
    }
  }, []);

  // Remove a file by index
  const removeFile = useCallback((index: number) => {
    setDroppedFiles(prev => prev.filter((_, i) => i !== index));
    if (droppedFiles.length <= 1) {
      setFolderName(null);
    }
  }, [droppedFiles.length]);

  useInput((input, key) => {
    // Enter: Submit files
    if (key.return) {
      // Process any pending input first
      if (inputValue.trim()) {
        processPath(inputValue);
        setInputValue('');
      }
      
      // Small delay to let state update
      setTimeout(() => {
        if (droppedFiles.length === 0) {
          setError('Drop a file or folder first');
          return;
        }

        const validation = validateBatchFiles(droppedFiles);
        if (!validation.valid) {
          setError(validation.error || 'Invalid files');
          return;
        }

        const batchFiles = toBatchFiles(droppedFiles);
        onFilesSelected(batchFiles);
      }, 10);
      return;
    }

    // Backspace: Remove last file or clear input
    if (key.backspace || key.delete) {
      if (inputValue.length > 0) {
        setInputValue(prev => prev.slice(0, -1));
      } else if (droppedFiles.length > 0) {
        removeFile(droppedFiles.length - 1);
      }
      return;
    }

    // Escape: Clear everything
    if (key.escape) {
      setDroppedFiles([]);
      setInputValue('');
      setFolderName(null);
      setError(null);
      return;
    }

    // Regular text input - accumulate for path
    if (input && !key.ctrl && !key.meta) {
      const newValue = inputValue + input;
      setInputValue(newValue);
      
      // Check if we have a complete path (ends with supported extension or is a directory)
      const cleanPath = newValue.trim().replace(/^["']|["']$/g, '');
      if (cleanPath && (getFileInfo(cleanPath) || isDirectory(cleanPath))) {
        processPath(cleanPath);
        setInputValue('');
      }
    }
  });

  const totalSize = calculateTotalSize(droppedFiles);
  const fileType = droppedFiles.length > 0 ? droppedFiles[0].type : null;

  // Truncate filename to fit nicely (max ~40 chars for the name part)
  const truncateFileName = (name: string, maxLen: number = 40): string => {
    if (name.length <= maxLen) return name;
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const baseName = name.slice(0, name.length - ext.length);
    const availableLen = maxLen - ext.length - 3; // 3 for "..."
    if (availableLen < 5) return name.slice(0, maxLen - 3) + '...';
    return baseName.slice(0, availableLen) + '...' + ext;
  };

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Divider />
      </Box>

      {/* Main drop zone message */}
      <Text color="yellow" bold>📁 Drop a file or folder</Text>
      <Box marginTop={1}>
        <Text color="#999999">Drop files one by one, or a folder for batch processing</Text>
      </Box>

      {/* Dropped files list */}
      {droppedFiles.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {/* Show folder name if files came from a folder */}
          {folderName && (
            <Box marginBottom={1}>
              <Text color="cyan">📂 {folderName}/</Text>
            </Box>
          )}
          
          <Box
            flexDirection="column"
            paddingX={1}
            borderStyle="round"
            borderColor="gray"
          >
            {droppedFiles.map((file, index) => (
              <Text key={file.path}>
                <Text color={droppedFiles.length > 1 ? "#666666" : "green"}>{index + 1}. </Text>
                <Text color="white">{truncateFileName(file.name)}</Text>
                <Text color="#666666"> ({formatBytes(file.size)})</Text>
              </Text>
            ))}
          </Box>

          {/* Summary */}
          <Box marginTop={1}>
            <Text color="green">
              ✓ {droppedFiles.length} {droppedFiles.length === 1 ? 'file' : 'files'} ready
              <Text color="#999999"> · {formatBytes(totalSize)} total · {fileType}</Text>
            </Text>
          </Box>
        </Box>
      )}

      {/* Empty state - drop zone hint */}
      {droppedFiles.length === 0 && (
        <Box
          marginTop={1}
          paddingX={1}
          borderStyle="round"
          borderColor="gray"
        >
          <Text color="#666666">Drop file or folder here...</Text>
        </Box>
      )}

      {/* Instructions */}
      <Box marginTop={1}>
        {droppedFiles.length === 0 ? (
          <Text color="#666666">Tip: Drop a folder to compress all files inside</Text>
        ) : (
          <Text color="#666666">
            Drop another file · Backspace to remove · Enter to continue
          </Text>
        )}
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

// BatchFileList component - shows files with their status
interface BatchFileListProps {
  files: BatchFileInfo[];
  currentIndex: number;
}

export const BatchFileList: React.FC<BatchFileListProps> = ({ files, currentIndex }) => {
  const getStatusIcon = (status: BatchFileInfo['status'], index: number) => {
    if (index === currentIndex && status === 'compressing') {
      return <Spinner />;
    }
    switch (status) {
      case 'completed':
        return <Text color="green">✓</Text>;
      case 'error':
        return <Text color="red">✗</Text>;
      case 'skipped':
        return <Text color="yellow">⊘</Text>;
      case 'compressing':
        return <Text color="cyan">⚙</Text>;
      default:
        return <Text color="#666666">○</Text>;
    }
  };

  const getResultText = (file: BatchFileInfo) => {
    if (file.status === 'completed' && file.result) {
      if (file.result.alreadyOptimized) {
        return <Text color="#fbbf24">already optimal</Text>;
      }
      const savedPct = Math.abs(file.result.savedPercentage);
      const isSmaller = file.result.savedBytes > 0;
      return (
        <Text color={isSmaller ? '#22c55e' : '#ef4444'}>
          {savedPct.toFixed(0)}% {isSmaller ? 'smaller' : 'larger'}
        </Text>
      );
    }
    if (file.status === 'compressing') {
      return <Text color="cyan">{file.progress.toFixed(0)}%</Text>;
    }
    if (file.status === 'error') {
      return <Text color="red">{file.error || 'failed'}</Text>;
    }
    return null;
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      {files.map((file, index) => (
        <Box key={file.id} flexDirection="row" alignItems="center">
          <Box width={3}>{getStatusIcon(file.status, index)}</Box>
          <Text color={index === currentIndex ? 'white' : '#999999'}>
            {file.name}
          </Text>
          <Text color="#666666"> ({formatBytes(file.size)})</Text>
          {getResultText(file) && (
            <Text color="#666666"> · {getResultText(file)}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};

// BatchProgress component - shows overall batch progress
interface BatchProgressProps {
  files: BatchFileInfo[];
  currentIndex: number;
  startTime: number;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({
  files,
  currentIndex,
  startTime,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const completedCount = files.filter(f => f.status === 'completed' || f.status === 'error' || f.status === 'skipped').length;
  const currentFile = files[currentIndex];
  const overallProgress = ((completedCount + (currentFile?.progress || 0) / 100) / files.length) * 100;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginTop={1}>
        <Divider />
      </Box>
      <Text color="yellow">
        Compressing {completedCount + 1} of {files.length} files · {overallProgress.toFixed(0)}% · {formatDuration(elapsed)}
      </Text>
      {currentFile && (
        <Box marginTop={1}>
          <Spinner label={`${currentFile.name} · ${currentFile.progress.toFixed(0)}%`} />
        </Box>
      )}
    </Box>
  );
};

// BatchSummary component - shows aggregate results with proper borders and colors
interface BatchSummaryProps {
  files: BatchFileInfo[];
  startTime: number;
}

export const BatchSummary: React.FC<BatchSummaryProps> = ({ files, startTime }) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;

  // Fixed box width - consistent sizing
  const boxWidth = Math.min(terminalWidth - 2, 80);
  const innerWidth = boxWidth - 4; // Account for "│ " and " │"

  // Helper to calculate padding needed for a line
  const getPadding = (lineContent: string): string => {
    const contentWidth = stringWidth(lineContent);
    const padding = Math.max(0, innerWidth - contentWidth);
    return ' '.repeat(padding);
  };

  const emptyLine = ' '.repeat(innerWidth);

  // Calculate stats
  const successFiles = files.filter(f => f.status === 'completed' && f.result && !f.result.alreadyOptimized);
  const skippedFiles = files.filter(f => f.status === 'completed' && f.result?.alreadyOptimized);
  const errorFiles = files.filter(f => f.status === 'error');

  const totalInputSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalOutputSize = files.reduce((sum, f) => {
    if (f.result && !f.result.alreadyOptimized) {
      return sum + f.result.outputSize;
    }
    return sum + f.size;
  }, 0);
  const totalSaved = totalInputSize - totalOutputSize;
  const savedPercentage = totalInputSize > 0 ? (totalSaved / totalInputSize) * 100 : 0;

  const duration = (Date.now() - startTime) / 1000;
  const timeText = duration < 60
    ? `${duration.toFixed(duration < 1 ? 1 : 0)}s`
    : formatDuration(duration);

  const inputMB = totalInputSize / (1024 * 1024);
  const outputMB = totalOutputSize / (1024 * 1024);
  const savedMB = Math.abs(totalSaved) / (1024 * 1024);
  const isSmaller = totalSaved > 0;

  // Build borders
  const headerText = 'Batch Complete!';
  const topBorder = `╭─ ${headerText} ${'─'.repeat(Math.max(0, boxWidth - headerText.length - 5))}╮`;
  const midBorder = `├${'─'.repeat(boxWidth - 2)}┤`;
  const bottomBorder = `╰${'─'.repeat(boxWidth - 2)}╯`;

  // Build line content strings for padding calculation
  let summaryText = `${successFiles.length} compressed`;
  if (skippedFiles.length > 0) summaryText += ` · ${skippedFiles.length} already optimal`;
  if (errorFiles.length > 0) summaryText += ` · ${errorFiles.length} failed`;
  const line1 = `🎉 ${summaryText}`;

  const line2 = `💾 ${inputMB.toFixed(2)} MB  →  ${outputMB.toFixed(2)} MB  (${isSmaller ? 'saved' : 'added'} ${savedMB.toFixed(2)} MB · ${savedPercentage.toFixed(0)}%)`;
  const line3 = `⚡ Completed in ${timeText}`;

  // Truncate filename helper for results
  const truncateForResults = (name: string, maxLen: number): string => {
    if (stringWidth(name) <= maxLen) return name;
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const baseName = name.slice(0, name.length - ext.length);
    const availableLen = maxLen - ext.length - 3;
    if (availableLen < 5) return name.slice(0, maxLen - 3) + '...';
    return baseName.slice(0, availableLen) + '...' + ext;
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Top border */}
      <Text color="#ff6b4a" bold>{topBorder}</Text>

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyLine}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Summary line with colors */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#ffd700">🎉 </Text>
        <Text color="white">{successFiles.length} compressed</Text>
        {skippedFiles.length > 0 && (
          <Text color="#fbbf24"> · {skippedFiles.length} already optimal</Text>
        )}
        {errorFiles.length > 0 && (
          <Text color="#ef4444"> · {errorFiles.length} failed</Text>
        )}
        <Text>{getPadding(line1)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyLine}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Size line with colors */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#60a5fa">💾 </Text>
        <Text color="white">{inputMB.toFixed(2)} MB</Text>
        <Text color="#999999">  →  </Text>
        <Text color={isSmaller ? '#22c55e' : '#ef4444'} bold>{outputMB.toFixed(2)} MB</Text>
        <Text color="#999999">  ({isSmaller ? 'saved' : 'added'} </Text>
        <Text color={isSmaller ? '#22c55e' : '#ef4444'} bold>{savedMB.toFixed(2)} MB · {savedPercentage.toFixed(0)}%</Text>
        <Text color="#999999">)</Text>
        <Text>{getPadding(line2)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Time line with colors */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#fbbf24">⚡ </Text>
        <Text color="white">Completed in </Text>
        <Text color="#fbbf24" bold>{timeText}</Text>
        <Text>{getPadding(line3)}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyLine}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Middle border */}
      <Text color="#ff6b4a">{midBorder}</Text>

      {/* Results header */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text color="#999999">Results:</Text>
        <Text>{getPadding('Results:')}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Per-file results with colors */}
      {files.map((file) => {
        const isError = file.status === 'error';
        const isOptimal = file.result?.alreadyOptimized;
        const icon = isError ? '✗' : isOptimal ? '⊘' : '✓';
        const iconColor = isError ? '#ef4444' : isOptimal ? '#fbbf24' : '#22c55e';

        let resultText = '';
        if (isError) {
          resultText = file.error || 'failed';
        } else if (isOptimal) {
          resultText = 'optimal';
        } else if (file.result) {
          const inMB = (file.result.inputSize / (1024 * 1024)).toFixed(1);
          const outMB = (file.result.outputSize / (1024 * 1024)).toFixed(1);
          const pct = Math.abs(file.result.savedPercentage).toFixed(0);
          resultText = `${inMB}→${outMB} MB (-${pct}%)`;
        }

        // Calculate available space for filename
        const fixedParts = `  ${icon}   ${resultText}`;
        const availableForName = innerWidth - stringWidth(fixedParts) - 2;
        const truncatedName = truncateForResults(file.name, Math.max(20, availableForName));
        const lineContent = `  ${icon} ${truncatedName}  ${resultText}`;

        return (
          <Text key={file.id}>
            <Text color="#ff6b4a">│ </Text>
            <Text>  </Text>
            <Text color={iconColor}>{icon} </Text>
            <Text color="white">{truncatedName}</Text>
            <Text color="#999999">  {resultText}</Text>
            <Text>{getPadding(lineContent)}</Text>
            <Text color="#ff6b4a"> │</Text>
          </Text>
        );
      })}

      {/* Empty line */}
      <Text>
        <Text color="#ff6b4a">│ </Text>
        <Text>{emptyLine}</Text>
        <Text color="#ff6b4a"> │</Text>
      </Text>

      {/* Bottom border */}
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

