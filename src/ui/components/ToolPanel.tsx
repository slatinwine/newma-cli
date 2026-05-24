import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import InkSpinner from 'ink-spinner';
import { ToolExecution } from '../state';

interface ToolPanelProps {
  tools: ToolExecution[];
}

export const ToolPanel: React.FC<ToolPanelProps> = ({ tools }) => {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  useInput((_ch, key) => {
    // Use Space to toggle expand (Enter conflicts with TextInput submit)
    if ((_ch === ' ') && tools.length > 0) {
      const running = tools.find(t => t.status === 'running') || tools[0];
      if (running) {
        const newExpanded = new Set(expandedTools);
        if (newExpanded.has(running.id)) {
          newExpanded.delete(running.id);
        } else {
          newExpanded.add(running.id);
        }
        setExpandedTools(newExpanded);
      }
    }
  });

  if (tools.length === 0) return null;

  const runningCount = tools.filter(t => t.status === 'running').length;

  return (
    <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="#9B59B6" paddingX={1}>
      <Box>
        <Text color="#9B59B6" bold>
          🔧 Tool Execution
        </Text>
        {runningCount > 0 && (
          <Text color="#E67E22"> ({runningCount} running)</Text>
        )}
      </Box>

      {tools.map(tool => {
        const isExpanded = expandedTools.has(tool.id);
        const isRunning = tool.status === 'running';
        const isDone = tool.status === 'done';
        const isFailed = tool.status === 'failed';

        return (
          <Box key={tool.id} flexDirection="column" marginTop={isExpanded ? 1 : 0}>
            <Box>
              <Box width={2}>
                {isRunning && (
                  <Text color="#E67E22">
                    <InkSpinner type="dots" />
                  </Text>
                )}
                {isDone && <Text color="#27AE60">✅</Text>}
                {isFailed && <Text color="#E74C3C">❌</Text>}
              </Box>
              <Box flexGrow={1}>
                <Text bold={isRunning} color={isRunning ? '#E67E22' : isDone ? '#27AE60' : isFailed ? '#E74C3C' : '#95A5A6'}>
                  {tool.name}
                </Text>
                <Text dimColor> — {tool.status}</Text>
                {isExpanded && tool.output && (
                  <Text dimColor color="#95A5A6">
                    {' '}
                    (Press Enter to collapse)
                  </Text>
                )}
                {!isExpanded && tool.output && (
                  <Text dimColor color="#95A5A6">
                    {' '}
                    (Press Space to expand)
                  </Text>
                )}
              </Box>
            </Box>

            {isExpanded && tool.output && (
              <Box
                marginLeft={3}
                borderStyle="round"
                borderColor={isFailed ? '#E74C3C' : '#95A5A6'}
                paddingX={1}
                marginTop={1}
              >
                <Text dimColor wrap="wrap">
                  {tool.output.slice(0, 500)}
                  {tool.output.length > 500 ? '...' : ''}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
