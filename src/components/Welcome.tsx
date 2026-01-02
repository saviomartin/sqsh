import React from 'react';
import { Box, Text } from 'ink';

export const Welcome: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="#ff6b4a">
        CompressX
      </Text>
      <Text color="#666666">Fast media compression for your terminal</Text>
    </Box>
  );
};
