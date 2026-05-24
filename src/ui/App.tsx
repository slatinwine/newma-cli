import React from 'react';
import { Box } from 'ink';
import { ChatView, ChatMessage } from './components/ChatView';
import { InputBar } from './components/InputBar';
import { StatusBar } from './components/StatusBar';

interface AppProps {
  model?: string;
  messages?: ChatMessage[];
}

export const App: React.FC<AppProps> = ({ model, messages = [] }) => {
  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column">
        <ChatView messages={messages} />
      </Box>
      <Box flexDirection="column">
        <InputBar />
        <StatusBar model={model} />
      </Box>
    </Box>
  );
};
