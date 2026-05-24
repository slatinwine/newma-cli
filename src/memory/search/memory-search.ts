/**
 * Memory Search - Unified Memory Search Engine
 *
 * Aggregates and searches across all memory managers in the system
 */

import { BM25Engine, SearchableDocument, BM25Result, BM25Options } from './bm25';
import { join } from 'path';

// Import all memory managers
import { ErrorMemoryManager } from '../error-memory';
import { ExecutionHistoryManager } from '../execution-history';
import { ReasoningManager } from '../reasoning-manager';
import { PreferencesManager } from '../preferences-manager';
import { SessionContextManager } from '../session-context-manager';
import { ContextManager } from '../context-manager';

// Import type definitions
import { ErrorRecord } from '../error-types';
import { CommandRecord } from '../execution-types';
import { ReasoningChain, ReasoningPattern } from '../reasoning-types';
import { SessionRecord } from '../session-context-types';

/**
 * Memory search source types
 */
export type MemorySource =
  | 'error'
  | 'execution'
  | 'reasoning'
  | 'session'
  | 'context'
  | 'preferences';

/**
 * Unified memory search result
 */
export interface MemorySearchResult {
  /**
   * Result source type
   */
  source: MemorySource;

  /**
   * Unique identifier
   */
  id: string;

  /**
   * Relevance score (0-1)
   */
  score: number;

  /**
   * Content snippet showing matched terms
   */
  snippet: string;

  /**
   * Full result data
   */
  data: ErrorRecord | CommandRecord | ReasoningChain | ReasoningPattern | SessionRecord | any;

  /**
   * Result timestamp
   */
  timestamp: string;

  /**
   * Additional metadata
   */
  metadata: Record<string, any>;

  /**
   * Matched terms with frequencies
   */
  matches: Array<{
    term: string;
    frequency: number;
  }>;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  /**
   * Filter by specific source(s)
   */
  sources?: MemorySource[];

  /**
   * Maximum results per source
   */
  limitPerSource?: number;

  /**
   * Minimum relevance threshold (0-1)
   */
  threshold?: number;

  /**
   * Whether to include snippets
   */
  includeSnippets?: boolean;

  /**
   * Time range filter (ISO dates)
   */
  timeRange?: {
    start?: string;
    end?: string;
  };

  /**
   * Custom filters for metadata
   */
  filters?: Record<string, any>;
}

/**
 * Memory search engine configuration
 */
export interface MemorySearchConfig {
  /**
   * Project root directory
   */
  projectRoot: string;

  /**
   * BM25 search options
   */
  bm25Options?: BM25Options;

  /**
   * Whether to automatically index on initialization
   */
  autoIndex?: boolean;

  /**
   * Index update interval in milliseconds (0 = manual only)
   */
  indexInterval?: number;
}

/**
 * Unified Memory Search Engine
 *
 * Provides cross-manager semantic search capabilities
 * across all memory systems in Newma
 */
export class MemorySearchEngine {
  private config: MemorySearchConfig;
  private projectRoot: string;

  // Memory managers
  private errorManager: ErrorMemoryManager;
  private executionManager: ExecutionHistoryManager;
  private reasoningManager: ReasoningManager;
  private preferencesManager: PreferencesManager;
  private sessionManager: SessionContextManager;
  private contextManager: ContextManager;

  // Search engines for each source
  private searchEngines: Map<MemorySource, BM25Engine>;

  // Index management
  private indexInterval: number | null = null;
  private isIndexing: boolean = false;

  constructor(config: MemorySearchConfig) {
    this.config = config;
    this.projectRoot = config.projectRoot;

    // Initialize memory managers
    this.errorManager = new ErrorMemoryManager(this.projectRoot);
    this.executionManager = new ExecutionHistoryManager(this.projectRoot);
    this.reasoningManager = new ReasoningManager(this.projectRoot);
    this.preferencesManager = new PreferencesManager(this.projectRoot);
    this.sessionManager = new SessionContextManager(this.projectRoot);
    this.contextManager = new ContextManager(this.projectRoot);

    // Initialize search engines
    this.searchEngines = new Map();
  }

  /**
   * Initialize the memory search engine
   */
  async initialize(): Promise<void> {
    // Initialize all memory managers
    await Promise.all([
      this.errorManager.initialize(),
      this.executionManager.initialize(),
      this.reasoningManager.initialize(),
      this.preferencesManager.initialize(),
      this.sessionManager.initialize(),
      this.contextManager.initialize(),
    ]);

    // Initialize search engines for each source
    const sources: MemorySource[] = ['error', 'execution', 'reasoning', 'session', 'context', 'preferences'];
    for (const source of sources) {
      const engine = new BM25Engine({
        ...this.config.bm25Options,
        indexDir: join(this.projectRoot, '.memo', 'search', source),
      });
      await engine.initialize();
      this.searchEngines.set(source, engine);
    }

    // Auto-index if enabled
    if (this.config.autoIndex) {
      await this.indexAll();
    }

    // Set up automatic indexing if interval is configured
    if (this.config.indexInterval && this.config.indexInterval > 0) {
      this.startIndexing();
    }
  }

  /**
   * Search across all or specific memory sources
   */
  async search(query: string, options: MemorySearchOptions = {}): Promise<MemorySearchResult[]> {
    const sources = options.sources || Array.from(this.searchEngines.keys());
    const limitPerSource = options.limitPerSource || 10;
    const threshold = options.threshold || 0.0;

    // Search each source in parallel
    const searchPromises = sources.map(source =>
      this.searchSource(source, query, {
        limit: limitPerSource,
        threshold,
        filters: options.filters,
        timeRange: options.timeRange,
      })
    );

    const results = await Promise.all(searchPromises);

    // Flatten and sort by score
    const flattenedResults = results.flat();
    flattenedResults.sort((a, b) => b.score - a.score);

    return flattenedResults;
  }

  /**
   * Search a specific memory source
   */
  async searchSource(
    source: MemorySource,
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      filters?: Record<string, any>;
      timeRange?: { start?: string; end?: string };
    } = {}
  ): Promise<MemorySearchResult[]> {
    const engine = this.searchEngines.get(source);
    if (!engine) {
      return [];
    }

    const bm25Results = engine.search(query, {
      limit: options.limit || 10,
      threshold: options.threshold || 0.0,
      filters: options.filters,
    });

    // Convert BM25 results to MemorySearchResults
    const memoryResults: MemorySearchResult[] = [];
    for (const result of bm25Results) {
      // Apply time range filter if specified
      if (options.timeRange) {
        const resultTime = new Date(result.metadata.timestamp || 0);
        if (options.timeRange.start && resultTime < new Date(options.timeRange.start)) {
          continue;
        }
        if (options.timeRange.end && resultTime > new Date(options.timeRange.end)) {
          continue;
        }
      }

      // Get full data from the appropriate manager
      const data = await this.getFullRecord(source, result.id);
      if (!data) {
        continue;
      }

      memoryResults.push({
        source,
        id: result.id,
        score: result.score,
        snippet: this.generateSnippet(data, query),
        data,
        timestamp: result.metadata.timestamp || new Date().toISOString(),
        metadata: result.metadata,
        matches: result.matches,
      });
    }

    return memoryResults;
  }

  /**
   * Index all memory sources
   */
  async indexAll(): Promise<void> {
    if (this.isIndexing) {
      return;
    }

    this.isIndexing = true;

    try {
      // Index each source
      await Promise.all([
        this.indexErrors(),
        this.indexExecutions(),
        this.indexReasoning(),
        this.indexSessions(),
        this.indexContext(),
        this.indexPreferences(),
      ]);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Index a specific source
   */
  async indexSource(source: MemorySource): Promise<void> {
    switch (source) {
      case 'error':
        await this.indexErrors();
        break;
      case 'execution':
        await this.indexExecutions();
        break;
      case 'reasoning':
        await this.indexReasoning();
        break;
      case 'session':
        await this.indexSessions();
        break;
      case 'context':
        await this.indexContext();
        break;
      case 'preferences':
        await this.indexPreferences();
        break;
    }
  }

  /**
   * Add a document to a specific source index
   */
  async addDocument(source: MemorySource, document: SearchableDocument): Promise<void> {
    const engine = this.searchEngines.get(source);
    if (!engine) {
      throw new Error(`Unknown source: ${source}`);
    }

    await engine.addDocument(document);
  }

  /**
   * Remove a document from a specific source index
   */
  async removeDocument(source: MemorySource, id: string): Promise<void> {
    const engine = this.searchEngines.get(source);
    if (!engine) {
      throw new Error(`Unknown source: ${source}`);
    }

    await engine.removeDocument(id);
  }

  /**
   * Get search statistics for all sources
   */
  getStatistics(): Map<MemorySource, any> {
    const stats = new Map<MemorySource, any>();
    for (const [source, engine] of this.searchEngines.entries()) {
      stats.set(source, engine.getStatistics());
    }
    return stats;
  }

  /**
   * Clear all search indexes
   */
  async clearAllIndexes(): Promise<void> {
    const clearPromises: Promise<void>[] = [];
    for (const engine of this.searchEngines.values()) {
      clearPromises.push(engine.clear());
    }
    await Promise.all(clearPromises);
  }

  /**
   * Stop automatic indexing
   */
  stopIndexing(): void {
    if (this.indexInterval !== null) {
      clearInterval(this.indexInterval);
      this.indexInterval = null;
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.stopIndexing();
    await this.clearAllIndexes();
  }

  /**
   * Private: Index error memories
   */
  private async indexErrors(): Promise<void> {
    const engine = this.searchEngines.get('error')!;
    await engine.clear();

    // Use searchErrors to get all errors (empty options = get all)
    const errors = await this.errorManager.searchErrors({});
    const documents: SearchableDocument[] = errors.map((error: any) => ({
      id: error.id,
      content: `${error.message} ${error.stackTrace || ''} ${error.category || ''} ${error.solution?.description || ''}`,
      metadata: {
        timestamp: error.timestamp,
        category: error.category,
        severity: error.severity,
        resolved: error.resolved,
        source: 'error',
      },
      timestamp: error.timestamp,
      type: 'error',
    }));

    await engine.addDocuments(documents);
  }

  /**
   * Private: Index execution history
   */
  private async indexExecutions(): Promise<void> {
    const engine = this.searchEngines.get('execution')!;
    await engine.clear();

    // Use searchHistory to get all execution history (empty options = get all)
    const history = await this.executionManager.searchHistory({});
    const documents: SearchableDocument[] = [];

    for (const entry of history) {
      // Handle both flat entries and session-based entries
      const command = (entry as any).command || entry;
      const output = (entry as any).output || '';
      const type = (entry as any).type || 'command';
      const timestamp = (entry as any).timestamp || new Date().toISOString();
      const status = (entry as any).status || 'unknown';
      const id = (entry as any).id || `exec-${Date.now()}-${Math.random()}`;

      documents.push({
        id,
        content: `${command} ${output} ${type}`,
        metadata: {
          timestamp,
          type,
          status,
          source: 'execution',
        },
        timestamp,
        type: 'execution',
      });
    }

    await engine.addDocuments(documents);
  }

  /**
   * Private: Index reasoning chains
   */
  private async indexReasoning(): Promise<void> {
    const engine = this.searchEngines.get('reasoning')!;
    await engine.clear();

    // Note: ReasoningManager doesn't have getAllChains/getAllPatterns methods
    // This is a placeholder implementation
    // In production, you'd need to add those methods or use searchSimilarChains

    const documents: SearchableDocument[] = [];

    // Index patterns (if available)
    try {
      const summary = await this.reasoningManager.getAIContextSummary();
      if (summary) {
        documents.push({
          id: 'reasoning-summary',
          content: summary,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'reasoning',
          },
          timestamp: new Date().toISOString(),
          type: 'reasoning-summary',
        });
      }
    } catch (error) {
      // Ignore if reasoning methods aren't available
    }

    await engine.addDocuments(documents);
  }

  /**
   * Private: Index session contexts
   */
  private async indexSessions(): Promise<void> {
    const engine = this.searchEngines.get('session')!;
    await engine.clear();

    const sessions = await this.sessionManager.getAllSessions();
    const documents: SearchableDocument[] = [];

    for (const session of sessions) {
      const content = session.messages
        .map(msg => `${msg.role} ${msg.content}`)
        .join(' ');

      documents.push({
        id: session.id,
        content,
        metadata: {
          timestamp: session.startTime,
          title: session.title,
          messageCount: session.stats.messageCount,
          source: 'session',
        },
        timestamp: session.startTime,
        type: 'session',
      });
    }

    await engine.addDocuments(documents);
  }

  /**
   * Private: Index project context
   */
  private async indexContext(): Promise<void> {
    const engine = this.searchEngines.get('context')!;
    await engine.clear();

    const documents: SearchableDocument[] = [];

    try {
      const context = await this.contextManager.getContext();

      // Index file changes
      if (context.recentChanges) {
        for (const change of context.recentChanges) {
          documents.push({
            id: `change-${change.timestamp}`,
            content: `${change.file} ${change.type}`,
            metadata: {
              timestamp: change.timestamp,
              type: change.type,
              source: 'context',
            },
            timestamp: change.timestamp,
            type: 'context-change',
          });
        }
      }

      // Index dependencies
      if (context.dependencies) {
        const depsContent = Object.entries(context.dependencies)
          .map(([name, version]) => `${name}@${version}`)
          .join(' ');

        documents.push({
          id: 'dependencies',
          content: depsContent,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'context',
          },
          timestamp: new Date().toISOString(),
          type: 'dependencies',
        });
      }
    } catch (error) {
      // Ignore if context methods aren't available
    }

    await engine.addDocuments(documents);
  }

  /**
   * Private: Index user preferences
   */
  private async indexPreferences(): Promise<void> {
    const engine = this.searchEngines.get('preferences')!;
    await engine.clear();

    const documents: SearchableDocument[] = [];

    try {
      const preferences = await this.preferencesManager.getPreferences();

      if (!preferences) {
        return;
      }

      for (const [key, value] of Object.entries(preferences)) {
        documents.push({
          id: `pref-${key}`,
          content: `${key} ${JSON.stringify(value)}`,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'preferences',
          },
          timestamp: new Date().toISOString(),
          type: 'preference',
        });
      }
    } catch (error) {
      // Ignore if preferences methods aren't available
    }

    await engine.addDocuments(documents);
  }

  /**
   * Private: Get full record from manager
   */
  private async getFullRecord(source: MemorySource, id: string): Promise<any> {
    switch (source) {
      case 'error': {
        // ErrorMemoryManager.searchErrors can filter by keyword
        const results = await this.errorManager.searchErrors({ keyword: id, limit: 1 });
        return results[0] || null;
      }
      case 'session':
        return await this.sessionManager.getSession(id);
      case 'execution':
      case 'reasoning':
      case 'context':
      case 'preferences':
        // TODO: add getter methods to these managers
        return null;
      default:
        return null;
    }
  }

  /**
   * Private: Generate snippet highlighting matched terms
   */
  private generateSnippet(data: any, query: string): string {
    if (!data) {
      return '';
    }

    // Extract relevant text based on data type
    let text = '';
    if (data.message) {
      text = data.message;
    } else if (data.command) {
      text = data.command;
    } else if (data.content) {
      text = data.content;
    } else if (data.description) {
      text = data.description;
    } else {
      text = JSON.stringify(data);
    }

    // Truncate if too long
    const maxLength = 200;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text;
  }

  /**
   * Private: Start automatic indexing
   */
  private startIndexing(): void {
    if (this.indexInterval !== null) {
      clearInterval(this.indexInterval);
    }

    this.indexInterval = setInterval(async () => {
      await this.indexAll();
    }, this.config.indexInterval) as unknown as number;
  }
}