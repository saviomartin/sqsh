import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { CompressionResult } from '../types.js';
import { formatBytes, formatDuration } from '../utils/formatBytes.js';

interface SummaryProps {
  result: CompressionResult;
}

export const Summary: React.FC<SummaryProps> = ({ result }) => {
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="green">✓</Text>
        <Text> Compressed successfully</Text>
      </Text>
      <Box
        flexDirection="column"
        marginTop={1}
        paddingX={1}
        paddingY={0}
        borderStyle="round"
        borderColor="gray"
      >
        <Text>
          <Text color="#666666">Size: </Text>
          <Text color="white">{formatBytes(result.inputSize)}</Text>
          <Text color="#666666"> → </Text>
          <Text color="green">{formatBytes(result.outputSize)}</Text>
          <Text color="#666666"> (saved {result.savedPercentage.toFixed(0)}%)</Text>
        </Text>
        <Text>
          <Text color="#666666">Time: </Text>
          <Text color="white">{formatDuration(result.duration)}</Text>
        </Text>
        <Text>
          <Text color="#666666">Output: </Text>
          <Text color="cyan">{result.outputPath}</Text>
        </Text>
      </Box>
    </Box>
  );
};
