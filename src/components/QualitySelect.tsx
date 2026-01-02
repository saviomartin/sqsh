import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import { QualityLevel } from '../types.js';

interface QualitySelectProps {
  onSelect: (quality: QualityLevel) => void;
}

const options = [
  { label: 'High (minimal compression)', value: 'high' as QualityLevel },
  { label: 'Medium (balanced)', value: 'medium' as QualityLevel },
  { label: 'Low (maximum compression)', value: 'low' as QualityLevel },
];

export const QualitySelect: React.FC<QualitySelectProps> = ({ onSelect }) => {
  const handleSelect = (value: string) => {
    onSelect(value as QualityLevel);
  };

  return (
    <Box flexDirection="column">
      <Text color="#666666">Select quality:</Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
      </Box>
    </Box>
  );
};
