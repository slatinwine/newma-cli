import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownView } from './MarkdownView';

export interface ChatMessage {
  role: 'user' | 'ai' | 'system' | 'tool';
  content: string;
  timestamp?: Date;
  toolName?: string;
  toolSuccess?: boolean;
  collapsed?: boolean;
}

interface ChatViewProps {
  messages: ChatMessage[];
}

export const ChatView: React.FC<ChatViewProps> = ({ messages }) => {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.length === 0 && (
        <Box marginTop={1} marginLeft={1}>
          <Text dimColor>牛码 v3.0 — AI-driven code assistant. Type /help for commands.</Text>
        </Box>
      )}
      {messages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={msg.role === 'tool' ? 0 : 1} marginLeft={1}>
          {msg.role === 'user' && (
            <Text color="#3498DB" bold>{'> '}</Text>
          )}
          {msg.role === 'ai' && (
            <Text color="#E67E22" bold>{'AI: '}</Text>
          )}
          {msg.role === 'system' && (
            <Text color="#95A5A6" dimColor>{'⚙ '}</Text>
          )}
          {msg.role === 'tool' && (
            <Text>
              <Text color="#9B59B6">{'🔧 '}</Text>
              <Text bold>{msg.toolName || 'tool'}</Text>
              <Text> {msg.toolSuccess ? '✅' : '❌'}</Text>
            </Text>
          )}
          {msg.role !== 'tool' && (
            <>
              {msg.role === 'ai' ? (
                <MarkdownView content={msg.content} />
              ) : (
                <Text wrap="wrap">{msg.content}</Text>
              )}
            </>
          )}
          {msg.role === 'tool' && !msg.collapsed && (
            <Text dimColor wrap="wrap">{msg.content.slice(0, 300)}{msg.content.length > 300 ? '...' : ''}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};
