import React from 'react';
import { Box, Text } from 'ink';

interface InputBarProps {
  prompt?: string;
  // Phase 1 placeholder kept for fallback
}

export const InputBar: React.FC<InputBarProps> = ({ prompt = '> ' }) => {
  // This component is no longer used directly in InkApp (we use ink-text-input inline)
  // Kept for backward compatibility
  return (
    <Box borderStyle="single" paddingLeft={1}>
      <Text color="#4ECDC4">{prompt}</Text>
      <Text dimColor>{' (placeholder)'}</Text>
    </Box>
  );
};
