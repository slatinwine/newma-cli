import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  model?: string;
  mode?: string;
  tokenCount?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  model = 'unknown',
  mode = 'normal',
  tokenCount,
}) => {
  return (
    <Box borderStyle="round" paddingLeft={1} paddingRight={1}>
      <Text color="#4ECDC4">{'牛码 '}</Text>
      <Text dimColor>{' | '}</Text>
      <Text color="#E67E22">{model}</Text>
      <Text dimColor>{' | '}</Text>
      <Text>{mode}</Text>
      {tokenCount !== undefined && (
        <>
          <Text dimColor>{' | '}</Text>
          <Text dimColor>{`tokens: ${tokenCount}`}</Text>
        </>
      )}
    </Box>
  );
};
