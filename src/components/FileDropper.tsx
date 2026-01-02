import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@inkjs/ui';
import { getFileInfo } from '../utils/fileUtils.js';
import { FileInfo } from '../types.js';

interface FileDropperProps {
  onFileSelected: (fileInfo: FileInfo) => void;
}

export const FileDropper: React.FC<FileDropperProps> = ({ onFileSelected }) => {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (filePath: string) => {
    const fileInfo = getFileInfo(filePath);

    if (!fileInfo) {
      setError('File not found or unsupported format');
      return;
    }

    onFileSelected(fileInfo);
  };

  return (
    <Box flexDirection="column">
      <Text color="#666666">Paste file path:</Text>
      <Box marginTop={1} paddingX={1} borderStyle="round" borderColor="gray">
        <TextInput placeholder="Drop or paste file..." onSubmit={handleSubmit} />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}
    </Box>
  );
};
