import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ChatView } from './components/ChatView';
import { LoadingSpinner } from './components/Spinner';
import { StatusBar } from './components/StatusBar';
import { MarkdownView } from './components/MarkdownView';
import { ToolPanel } from './components/ToolPanel';
import { PermissionDialog } from './components/PermissionDialog';
import { uiStore, UIState } from './state';

interface InkAppProps {
  onSubmit: (input: string) => void;
  onInterrupt: () => void;
  model?: string;
}

export const InkApp: React.FC<InkAppProps> = ({ onSubmit, onInterrupt, model }) => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [permSelected, setPermSelected] = useState<'Y' | 'N' | 'A'>('Y');
  const [state, setState] = useState<UIState>(uiStore.getState());

  // Subscribe to store changes
  useEffect(() => {
    const handler = () => setState({ ...uiStore.getState() });
    uiStore.on('change', handler);
    return () => { uiStore.off('change', handler); };
  }, []);

  // Set model if provided
  useEffect(() => {
    if (model) uiStore.setModel(model);
  }, [model]);

  // Unified keyboard input handler
  useInput((_ch, key) => {
    // Priority 1: Permission dialog consumes all input when active
    if (state.permissionRequest) {
      if (key.return || _ch === 'y' || _ch === 'Y') {
        setPermSelected('Y');
        uiStore.resolvePermission(true, false);
      } else if (_ch === 'n' || _ch === 'N') {
        setPermSelected('N');
        uiStore.resolvePermission(false, false);
      } else if (_ch === 'a' || _ch === 'A') {
        setPermSelected('A');
        uiStore.resolvePermission(true, true);
      }
      return;
    }

    // Priority 2: History navigation
    if (key.upArrow && history.length > 0) {
      const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx]);
    } else if (key.downArrow) {
      if (historyIdx >= 0) {
        const newIdx = historyIdx + 1;
        if (newIdx >= history.length) {
          setHistoryIdx(-1);
          setInput('');
        } else {
          setHistoryIdx(newIdx);
          setInput(history[newIdx]);
        }
      }
    }
  });

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed === '/exit' || trimmed === '/quit') {
      exit();
      return;
    }

    setHistory(prev => [...prev, trimmed]);
    setHistoryIdx(-1);
    uiStore.addMessage({ role: 'user', content: trimmed, timestamp: new Date() });
    setInput('');
    onSubmit(trimmed);
  };

  useInput((_ch, key) => {
    if (key.upArrow && history.length > 0) {
      const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx]);
    } else if (key.downArrow) {
      if (historyIdx >= 0) {
        const newIdx = historyIdx + 1;
        if (newIdx >= history.length) {
          setHistoryIdx(-1);
          setInput('');
        } else {
          setHistoryIdx(newIdx);
          setInput(history[newIdx]);
        }
      }
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat messages area - takes available space */}
      <Box flexGrow={1} flexDirection="column" overflow="hidden">
        <ChatView messages={state.messages} />
      </Box>

      {/* Tool execution panel - shown when tools are running */}
      {state.tools.length > 0 && (
        <ToolPanel tools={state.tools} />
      )}

      {/* Streaming content - real-time AI output above spinner */}
      {state.streamingContent && (
        <Box flexDirection="column" marginLeft={1} marginBottom={1}>
          <Text color="#E67E22" bold>{'AI: '}</Text>
          <MarkdownView content={state.streamingContent} />
        </Box>
      )}

      {/* Loading spinner - fixed position above input */}
      {state.loading && (
        <Box marginLeft={1} marginBottom={1}>
          <LoadingSpinner label={state.spinnerText || 'Thinking...'} />
        </Box>
      )}

      {/* Permission dialog - overlays everything when active */}
      {state.permissionRequest && (
        <Box marginLeft={1} marginBottom={1}>
          <PermissionDialog request={state.permissionRequest} selected={permSelected} />
        </Box>
      )}

      {/* Input bar - fixed at bottom */}
      <Box borderStyle="single" paddingLeft={1}>
        <Text color="#4ECDC4">{state.prompt}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={state.permissionRequest ? () => {} : handleSubmit}
          placeholder={state.permissionRequest ? '(Press Y/N/A)' : ''}
        />
      </Box>

      {/* Status bar - fixed at very bottom */}
      <StatusBar model={state.model} mode={state.mode} tokenCount={state.tokenCount} />
    </Box>
  );
};
