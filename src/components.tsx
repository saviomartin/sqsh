import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { Select, TextInput, ConfirmInput, Spinner } from '@inkjs/ui';
import path from 'path';
import stringWidth from 'string-width';
import { QualityLevel, FileInfo, CompressionResult } from './types';
import { getFileInfo, formatBytes, formatDuration, estimateCompressedSize } from './utils';

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
      <Text color="#999999">Fast media compression for your terminal</Text>
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
        <Text color="#999999">Drag and drop the file or paste in the file path</Text>
      </Box>
      <Box marginTop={1} flexDirection="row" alignItems="center" paddingX={1} borderStyle="round" borderColor="gray">
        <Text color="white">{'> '}</Text>
        <Box flexGrow={1}>
          {showPlaceholder ? (
            <Text color="#666666">/path/to/your/file.mp4</Text>
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

const qualityDetails: Record<QualityLevel, { label: string; description: string }> = {
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

export const QualitySelect: React.FC<QualitySelectProps> = ({ fileInfo, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const qualityLevels: QualityLevel[] = ['high', 'medium', 'low'];

  useInput((input, key) => {
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

// Summary component
interface SummaryProps {
  result: CompressionResult;
}

export const Summary: React.FC<SummaryProps> = ({ result }) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;
  const boxWidth = Math.min(terminalWidth - 4, 72); // Leave some margin, max 72
  const contentWidth = boxWidth - 2; // 70 characters for content between borders
  const isMacOS = process.platform === 'darwin';
  const clickInstruction = isMacOS ? '⌘+Click' : 'Ctrl+Click';
  
  const savedMB = result.savedBytes / (1024 * 1024);
  const inputMB = result.inputSize / (1024 * 1024);
  const outputMB = result.outputSize / (1024 * 1024);
  
  const fileName = result.outputPath.split('/').pop() || result.outputPath;
  const originalFileName = fileName.replace('-compressed', '').replace(/\.[^.]+$/, '') + path.extname(result.outputPath);
  const timeText = result.duration < 60 
    ? `${result.duration}s` 
    : formatDuration(result.duration);
  
  // Determine quality loss text based on saved percentage
  const qualityText = result.savedPercentage < 10 
    ? 'with zero quality loss' 
    : result.savedPercentage < 30 
    ? 'with minimal quality loss' 
    : 'with optimized quality';

  // Calculate header and footer line lengths
  const headerLine = '─'.repeat(Math.max(0, boxWidth - 26)); // Reduce by one dash as requested
  const footerLine = '─'.repeat(Math.max(0, boxWidth - 2));  // 1 char for prefix + 1 for suffix = 2

  // Helper to build a complete colored line with exact padding
  const buildLine = (content: string, paddingNeeded: number): string => {
    return content + ' '.repeat(paddingNeeded);
  };

  // Calculate content strings (what will be displayed)
  const content1 = ` 🎉 ${originalFileName} → ${result.savedPercentage.toFixed(0)}% smaller`;
  const content2 = ` 💾 ${inputMB.toFixed(2)} MB  →  ${outputMB.toFixed(2)} MB  (saved ${savedMB.toFixed(2)} MB)`;
  const content3 = ` ⚡ Compressed in ${timeText} ${qualityText}`;
  const content4 = ` 📁 ${result.outputPath}`;
  const content5 = `      ${clickInstruction} to reveal in Finder`;
  
  const emptyLine = ' '.repeat(contentWidth);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Text color="#ff6b4a" bold>╭─ Compression Complete! {headerLine}╮</Text>
      
      {/* Content Box */}
      <Box flexDirection="column">
        {/* Empty line */}
        <Text color="#ff6b4a">│{emptyLine}│</Text>
        
        {/* Success message with percentage */}
        <Text>
          <Text color="#ff6b4a">│</Text>
          <Text color="#ffd700"> 🎉 </Text>
          <Text color="white">{originalFileName}</Text>
          <Text color="white"> → </Text>
          <Text color="#22c55e" bold>{result.savedPercentage.toFixed(0)}% smaller</Text>
          <Text>{' '.repeat(contentWidth - stringWidth(content1))}</Text>
          <Text color="#ff6b4a">│</Text>
        </Text>
        
        {/* Empty line */}
        <Text color="#ff6b4a">│{emptyLine}│</Text>
        
        {/* File sizes */}
        <Text>
          <Text color="#ff6b4a">│</Text>
          <Text color="#60a5fa"> 💾 </Text>
          <Text color="white">{inputMB.toFixed(2)} MB</Text>
          <Text color="#999999">  →  </Text>
          <Text color="#22c55e" bold>{outputMB.toFixed(2)} MB</Text>
          <Text color="#999999">  (saved </Text>
          <Text color="#3b82f6" bold>{savedMB.toFixed(2)} MB</Text>
          <Text color="#999999">)</Text>
          <Text>{' '.repeat(contentWidth - stringWidth(content2))}</Text>
          <Text color="#ff6b4a">│</Text>
        </Text>
        
        {/* Time and quality */}
        <Text>
          <Text color="#ff6b4a">│</Text>
          <Text color="#fbbf24"> ⚡ </Text>
          <Text color="white">Compressed in </Text>
          <Text color="#fbbf24" bold>{timeText}</Text>
          <Text color="#999999"> {qualityText}</Text>
          <Text>{' '.repeat(contentWidth - stringWidth(content3))}</Text>
          <Text color="#ff6b4a">│</Text>
        </Text>
        
        {/* Empty line */}
        <Text color="#ff6b4a">│{emptyLine}│</Text>
        
        {/* Output path */}
        <Text>
          <Text color="#ff6b4a">│</Text>
          <Text color="#60a5fa"> 📁 </Text>
          <Text color="cyan">{result.outputPath}</Text>
          <Text>{' '.repeat(contentWidth - stringWidth(content4))}</Text>
          <Text color="#ff6b4a">│</Text>
        </Text>
        
        {/* Click instruction */}
        <Text>
          <Text color="#ff6b4a">│</Text>
          <Text>      </Text>
          <Text color="#999999">{clickInstruction} to reveal in Finder</Text>
          <Text>{' '.repeat(contentWidth - stringWidth(content5))}</Text>
          <Text color="#ff6b4a">│</Text>
        </Text>
      </Box>
      
      {/* Footer */}
      <Text color="#ff6b4a" bold>╰{footerLine}╯</Text>
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

