import { EventEmitter } from 'events';
import { ChatMessage } from './components/ChatView';

export interface ToolExecution {
  id: string;
  name: string;
  status: 'running' | 'done' | 'failed';
  output?: string;
  startTime: Date;
}

export interface PermissionRequest {
  id: string;
  action: string;
  details: string;
  resolve: (approved: boolean, alwaysAllow?: boolean) => void;
  reject: () => void;
}

export interface UIState {
  messages: ChatMessage[];
  loading: boolean;
  spinnerText: string;
  prompt: string;
  model: string;
  mode: string;
  tokenCount: number;
  tools: ToolExecution[];
  permissionRequest: PermissionRequest | null;
  streamingContent: string;
}

export type UIEventType = 'message' | 'loading' | 'prompt' | 'model' | 'mode' | 'tokens' | 'clear' | 'tools' | 'permission' | 'streaming';

class UIStore extends EventEmitter {
  private state: UIState;

  constructor() {
    super();
    this.state = {
      messages: [],
      loading: false,
      spinnerText: '',
      prompt: '> ',
      model: 'unknown',
      mode: 'normal',
      tokenCount: 0,
      tools: [],
      permissionRequest: null,
      streamingContent: '',
    };
  }

  getState(): Readonly<UIState> {
    return this.state;
  }

  addMessage(msg: ChatMessage): void {
    this.state.messages = [...this.state.messages, msg];
    this.emit('change', 'message');
  }

  updateLastMessage(content: string): void {
    const msgs = this.state.messages;
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      this.state.messages = [
        ...msgs.slice(0, -1),
        { ...last, content },
      ];
      this.emit('change', 'message');
    }
  }

  setLoading(loading: boolean, text = ''): void {
    this.state = { ...this.state, loading, spinnerText: text };
    this.emit('change', 'loading');
  }

  setPrompt(prompt: string): void {
    this.state = { ...this.state, prompt };
    this.emit('change', 'prompt');
  }

  setModel(model: string): void {
    this.state = { ...this.state, model };
    this.emit('change', 'model');
  }

  setMode(mode: string): void {
    this.state = { ...this.state, mode };
    this.emit('change', 'mode');
  }

  setTokenCount(count: number): void {
    this.state = { ...this.state, tokenCount: count };
    this.emit('change', 'tokens');
  }

  clearMessages(): void {
    this.state = { ...this.state, messages: [], streamingContent: '' };
    this.emit('change', 'clear');
  }

  // Tool execution tracking
  startTool(id: string, name: string): void {
    const tool: ToolExecution = {
      id,
      name,
      status: 'running',
      startTime: new Date(),
    };
    this.state = {
      ...this.state,
      tools: [...this.state.tools, tool],
    };
    this.emit('change', 'tools');
  }

  updateTool(id: string, status: 'done' | 'failed', output?: string): void {
    this.state = {
      ...this.state,
      tools: this.state.tools.map(t =>
        t.id === id ? { ...t, status, output } : t
      ),
    };
    this.emit('change', 'tools');
  }

  clearTools(): void {
    this.state = { ...this.state, tools: [] };
    this.emit('change', 'tools');
  }

  // Permission request handling
  requestPermission(
    action: string,
    details: string
  ): Promise<{ approved: boolean; alwaysAllow: boolean }> {
    return new Promise<{ approved: boolean; alwaysAllow: boolean }>((resolve, reject) => {
      const id = `perm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.state = {
        ...this.state,
        permissionRequest: { id, action, details, resolve: resolve as any, reject },
      };
      this.emit('change', 'permission');
    });
  }

  resolvePermission(approved: boolean, alwaysAllow = false): void {
    const req = this.state.permissionRequest;
    if (req) {
      req.resolve(approved, alwaysAllow);
      this.state = { ...this.state, permissionRequest: null };
      this.emit('change', 'permission');
    }
  }

  rejectPermission(): void {
    const req = this.state.permissionRequest;
    if (req) {
      req.reject();
      this.state = { ...this.state, permissionRequest: null };
      this.emit('change', 'permission');
    }
  }

  // Streaming content for real-time AI output
  startStreaming(): void {
    this.state = { ...this.state, streamingContent: '' };
    this.emit('change', 'streaming');
  }

  appendStreaming(content: string): void {
    this.state = {
      ...this.state,
      streamingContent: this.state.streamingContent + content,
    };
    this.emit('change', 'streaming');
  }

  finishStreaming(): void {
    const content = this.state.streamingContent;
    if (content) {
      this.addMessage({
        role: 'ai',
        content,
        timestamp: new Date(),
      });
    }
    this.state = { ...this.state, streamingContent: '' };
    this.emit('change', 'streaming');
  }
}

export const uiStore = new UIStore();
