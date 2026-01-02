import React from 'react';
import { Box, Text } from 'ink';

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
