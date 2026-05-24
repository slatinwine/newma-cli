import React from 'react';
import { Box, Text } from 'ink';
import { PermissionRequest } from '../state';

interface PermissionDialogProps {
  request: PermissionRequest;
  selected: 'Y' | 'N' | 'A';
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({ request, selected }) => {

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="#F39C12" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="#F39C12" bold>
          ⚠️ Permission Required
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold>Action:</Text>
        <Text> {request.action}</Text>
      </Box>

      {request.details && (
        <Box marginBottom={1}>
          <Text dimColor>{request.details}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="#27AE60">
          {selected === 'Y' && '[Y]'}
          {selected !== 'Y' && ' Y '}
        </Text>
        <Text dimColor>es </Text>

        <Text color="#E74C3C">
          {selected === 'N' && '[N]'}
          {selected !== 'N' && ' N '}
        </Text>
        <Text dimColor>o </Text>

        <Text color="#3498DB">
          {selected === 'A' && '[A]'}
          {selected !== 'A' && ' A '}
        </Text>
        <Text dimColor>lways allow</Text>
      </Box>
    </Box>
  );
};
