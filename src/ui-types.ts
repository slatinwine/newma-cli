// Type declarations for dynamically imported ESM UI modules
export interface InkREPLBridge {
  start(): Promise<void>;
  getStore(): any;
}

export interface InkREPLBridgeFactory {
  createInkREPLBridge(options: {
    onSubmit: (input: string) => void;
    onInterrupt: () => void;
    model?: string;
  }): InkREPLBridge;
}

export interface OutputAdapterShim {
  log(msg: string): void;
  success(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
  toolStart(name: string, args: string): void;
  toolResult(name: string, success: boolean, output: string): void;
  spinner(text: string): any;
  clear(): void;
  setPrompt(text: string): void;
  write(msg: string): void;
  aiStart(): void;
  aiStream(token: string): void;
  aiEnd(): void;
}
