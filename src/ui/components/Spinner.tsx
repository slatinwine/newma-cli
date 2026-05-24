import React from 'react';
import InkSpinner from 'ink-spinner';
import { Box, Text } from 'ink';

interface LoadingProps {
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingProps> = ({ label = 'Loading' }) => {
  return (
    <Box marginTop={1} marginLeft={1}>
      <Text color="#4ECDC4">
        <InkSpinner type="dots" />
      </Text>
      <Text>{` ${label}`}</Text>
    </Box>
  );
};
