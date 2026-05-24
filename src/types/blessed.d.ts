declare module 'blessed' {
  interface Options {
    fg?: string;
    bg?: string;
    bold?: boolean;
    underline?: boolean;
    fullscreen?: boolean;
    dockBorders?: boolean;
    title?: string;
    border?: any;
    tags?: boolean;
    keys?: boolean;
    input?: boolean;
    output?: any;
    log?: string;
    style?: any;
    label?: string;
    content?: string;
    top?: string | number;
    left?: string | number;
    width?: string | number;
    height?: string | number;
    scrollable?: boolean;
    mouse?: boolean;
    scrollbar?: any;
    vi?: boolean;
  }

  class Element {
    append(el: Element): void;
    prepend(el: Element): void;
    removeChild(el: Element): void;
    focus(): void;
    show(): void;
    hide(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    setContent(content: string): void;
    setContent(content: string[] | any): void;
    scroll(offset: number): void;
    setLine(offset: number, line: string): void;
    getLine(offset: number): string | undefined;
    clearLine(offset: number): void;
    deleteLine(offset: number): void;
    insertLine(offset: number, line: string): void;
    setLabel(label: string): void;
  }

  class Box extends Element {
    constructor(opts?: Options);
  }

  class Form extends Element {
    constructor(opts?: Options);
    submit(): void;
    reset(): void;
  }

  class Textarea extends Element {
    constructor(opts?: Options);
    value: string;
    setValue(value: string): void;
    getValue(): string;
  }

  class Button extends Element {
    constructor(opts?: Options);
  }

  class Screen {
    constructor(opts?: Options);
    append(el: Element): void;
    render(): void;
    destroy(): void;
    key(key: string | string[], callback: () => void): void;
    on(event: string, callback: (...args: any[]) => void): void;
    removeKey(key: string | string[]): void;
    alloc(): void;
    reflow(): void;
    reset(): void;
    crop(): void;
    leave(): void;
    screenshot(): void;
    focusPush(el: Element): void;
    focusPop(): void;
    restoreFocus(): void;
    saveFocus(): void;
    rewindFocus(): void;
    emit(event: string, ...args: any[]): void;
    emitKeypush(key: string, chunk: any): void;
    emitKey(key: string, chunk: any): void;
    emitMouse(event: any): void;
  }

  interface Blessed {
    screen(opts?: Options): Screen;
    box(opts?: Options): Box;
    textbox(opts?: Options): Textarea;
    form(opts?: Options): Form;
    button(opts?: Options): Button;
    (opts?: Options): Screen;
  }

  const blessed: Blessed;
  export = blessed;
}
