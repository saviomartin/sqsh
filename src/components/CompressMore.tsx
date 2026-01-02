import React from 'react';
import { Box, Text } from 'ink';
import { ConfirmInput } from '@inkjs/ui';

interface CompressMoreProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const CompressMore: React.FC<CompressMoreProps> = ({ onConfirm, onCancel }) => {
  return (
    <Box flexDirection="row" gap={1} marginTop={1}>
      <Text color="#666666">Compress another file?</Text>
      <ConfirmInput onConfirm={onConfirm} onCancel={onCancel} />
    </Box>
  );
};
