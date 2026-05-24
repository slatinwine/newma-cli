// src/ui/ink-repl.ts — Bridge between Ink TUI and REPL logic
// ESM module, compiled by tsconfig.ui.json

import React from 'react';
import { render } from 'ink';
import { InkApp } from './InkApp';
import { uiStore } from './state';

export interface InkREPLBridge {
  start(): Promise<void>;
  getStore(): typeof uiStore;
}

export function createInkREPLBridge(options: {
  onSubmit: (input: string) => void;
  onInterrupt: () => void;
  model?: string;
}): InkREPLBridge {
  async function start(): Promise<void> {
    const app = React.createElement(InkApp, {
      onSubmit: options.onSubmit,
      onInterrupt: options.onInterrupt,
      model: options.model,
    });

    const instance = render(app);
    await instance.waitUntilExit();
  }

  function getStore(): typeof uiStore {
    return uiStore;
  }

  return { start, getStore };
}
