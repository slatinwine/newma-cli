/**
 * Memory Search - BM25 Search Engine
 *
 * Pure TypeScript implementation of BM25 ranking algorithm for semantic search
 * Based on: Okapi BM25 probabilistic retrieval model
 */

import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import { Tokenizer, TokenizerOptions, tokenize, TokenizationResult } from './tokenizer';

/**
 * Document interface for BM25 indexing
 */
export interface SearchableDocument {
  /**
   * Unique document identifier
   */
  id: string;

  /**
   * Document content to search
   */
  content: string;

  /**
   * Optional metadata for filtering/display
   */
  metadata?: Record<string, any>;

  /**
   * Document timestamp for recency scoring
   */
  timestamp?: string;

  /**
   * Document type/category
   */
  type?: string;

  /**
   * Optional pre-tokenized terms (if already tokenized)
   */
  terms?: string[];
}

/**
 * BM25 search options
 */
export interface BM25Options {
  /**
   * BM25 parameter k1 - controls term frequency saturation
   * Typical range: 1.2 - 2.0
   * @default 1.5
   */
  k1?: number;

  /**
   * BM25 parameter b - controls length normalization
   * Typical range: 0.0 - 1.0
   * @default 0.75
   */
  b?: number;

  /**
   * Tokenizer options
   */
  tokenizerOptions?: TokenizerOptions;

  /**
   * Whether to persist index to disk
   * @default true
   */
  persistIndex?: boolean;

  /**
   * Directory for index persistence
   * @default '.memo/search'
   */
  indexDir?: string;
}

/**
 * BM25 search result
 */
export interface BM25Result {
  /**
   * Document ID
   */
  id: string;

  /**
   * BM25 relevance score
   */
  score: number;

  /**
   * Matched terms with their frequencies
   */
  matches: Array<{
    term: string;
    frequency: number;
  }>;

  /**
   * Document metadata
   */
  metadata: Record<string, any>;
}

/**
 * Index statistics
 */
export interface IndexStatistics {
  documentCount: number;
  totalTerms: number;
  uniqueTerms: number;
  averageDocumentLength: number;
  lastUpdated: string;
}

/**
 * BM25 index data structure for persistence
 */
interface BM25IndexData {
  documents: Map<string, SearchableDocument>;
  documentFrequency: Map<string, number>;
  documentLengths: Map<string, number>;
  totalDocuments: number;
  averageDocumentLength: number;
  totalTerms: number;
  lastUpdated: string;
}

/**
 * BM25 Search Engine
 *
 * Implements the Okapi BM25 probabilistic retrieval model
 * for efficient full-text search with relevance ranking
 */
export class BM25Engine {
  private options: Required<BM25Options>;
  private tokenizer: Tokenizer;

  // Index data structures
  private documents: Map<string, SearchableDocument>;
  private documentTerms: Map<string, string[]>; // docId -> terms
  private termFrequency: Map<string, Map<string, number>>; // term -> (docId -> freq)
  private documentFrequency: Map<string, number>; // term -> number of docs containing term
  private documentLengths: Map<string, number>; // docId -> length in terms

  // Index statistics
  private totalDocuments: number = 0;
  private averageDocumentLength: number = 0;
  private totalTerms: number = 0;

  // Persistence
  private indexFilePath: string;

  constructor(options: BM25Options = {}) {
    this.options = {
      k1: options.k1 ?? 1.5,
      b: options.b ?? 0.75,
      tokenizerOptions: options.tokenizerOptions ?? {},
      persistIndex: options.persistIndex ?? true,
      indexDir: options.indexDir ?? '.memo/search',
    };

    this.tokenizer = new Tokenizer(this.options.tokenizerOptions);

    // Initialize data structures
    this.documents = new Map();
    this.documentTerms = new Map();
    this.termFrequency = new Map();
    this.documentFrequency = new Map();
    this.documentLengths = new Map();

    // Set index file path
    this.indexFilePath = join(this.options.indexDir, 'index.json');
  }

  /**
   * Initialize the search engine (load persisted index if exists)
   */
  async initialize(): Promise<void> {
    if (this.options.persistIndex) {
      await this.loadIndex();
    }
  }

  /**
   * Add a document to the index
   */
  async addDocument(document: SearchableDocument): Promise<void> {
    const { id, content, metadata = {}, timestamp = new Date().toISOString() } = document;

    // Remove existing document if it exists
    if (this.documents.has(id)) {
      await this.removeDocument(id);
    }

    // Tokenize content
    let terms: string[];
    if (document.terms) {
      terms = document.terms;
    } else {
      const result = this.tokenizer.tokenize(content);
      terms = result.tokens;
    }

    // Store document
    this.documents.set(id, { ...document, metadata: { ...metadata, timestamp } });
    this.documentTerms.set(id, terms);
    this.documentLengths.set(id, terms.length);

    // Update term frequencies
    const termFreqs = new Map<string, number>();
    for (const term of terms) {
      const count = (termFreqs.get(term) || 0) + 1;
      termFreqs.set(term, count);
    }

    // Update global term frequency map
    for (const [term, count] of termFreqs.entries()) {
      if (!this.termFrequency.has(term)) {
        this.termFrequency.set(term, new Map());
      }
      this.termFrequency.get(term)!.set(id, count);

      // Update document frequency
      const currentDF = this.documentFrequency.get(term) || 0;
      this.documentFrequency.set(term, currentDF + 1);
    }

    // Update statistics
    this.totalDocuments++;
    this.totalTerms += terms.length;
    this.updateAverageDocumentLength();

    // Persist index if enabled
    if (this.options.persistIndex) {
      await this.saveIndex();
    }
  }

  /**
   * Add multiple documents in batch
   * More efficient than individual addDocument calls (single disk write)
   */
  async addDocuments(documents: SearchableDocument[]): Promise<void> {
    // Temporarily disable auto-save for batch operations
    const prevPersist = this.options.persistIndex;
    this.options.persistIndex = false;

    try {
      for (const doc of documents) {
        await this.addDocument(doc);
      }
    } finally {
      this.options.persistIndex = prevPersist;
      // Save once at the end
      if (this.options.persistIndex) {
        await this.saveIndex();
      }
    }
  }

  /**
   * Remove a document from the index
   */
  async removeDocument(id: string): Promise<void> {
    if (!this.documents.has(id)) {
      return;
    }

    const terms = this.documentTerms.get(id);
    if (!terms) {
      return;
    }

    const oldLength = terms.length;

    // Update document frequency for each term
    for (const term of terms) {
      const df = this.documentFrequency.get(term) || 0;
      if (df <= 1) {
        this.documentFrequency.delete(term);
        this.termFrequency.delete(term);
      } else {
        this.documentFrequency.set(term, df - 1);
        this.termFrequency.get(term)?.delete(id);
      }
    }

    // Remove document data
    this.documents.delete(id);
    this.documentTerms.delete(id);
    this.documentLengths.delete(id);

    // Update statistics
    this.totalDocuments--;
    this.totalTerms -= oldLength;
    this.updateAverageDocumentLength();

    // Persist index if enabled
    if (this.options.persistIndex) {
      await this.saveIndex();
    }
  }

  /**
   * Search for documents matching a query
   */
  search(query: string, options?: {
    limit?: number;
    threshold?: number;
    filters?: Record<string, any>;
  }): BM25Result[] {
    const limit = options?.limit ?? 10;
    const threshold = options?.threshold ?? 0.0;
    const filters = options?.filters;

    // Tokenize query
    const queryResult = this.tokenizer.tokenize(query);
    const queryTerms = queryResult.tokens;

    if (queryTerms.length === 0 || this.totalDocuments === 0) {
      return [];
    }

    // Calculate BM25 scores for each document
    const scores: Map<string, number> = new Map();
    const matches: Map<string, Array<{ term: string; frequency: number }>> = new Map();

    for (const term of queryTerms) {
      const df = this.documentFrequency.get(term) || 0;
      if (df === 0) {
        continue; // Term not in corpus
      }

      // Calculate IDF (Inverse Document Frequency)
      const idf = Math.log(
        (this.totalDocuments - df + 0.5) / (df + 0.5) + 1
      );

      // Get documents containing this term
      const termDocs = this.termFrequency.get(term);
      if (!termDocs) {
        continue;
      }

      for (const [docId, freq] of termDocs.entries()) {
        const docLength = this.documentLengths.get(docId) || 0;

        // Calculate BM25 score for this term
        const tf = freq; // Term frequency in document
        const numerator = tf * (this.options.k1 + 1);
        const denominator = tf +
          this.options.k1 * (1 - this.options.b + this.options.b * (docLength / this.averageDocumentLength));

        const termScore = idf * (numerator / denominator);

        // Accumulate score
        const currentScore = scores.get(docId) || 0;
        scores.set(docId, currentScore + termScore);

        // Track matches
        if (!matches.has(docId)) {
          matches.set(docId, []);
        }
        matches.get(docId)!.push({ term, frequency: freq });
      }
    }

    // Convert to results array
    const results: BM25Result[] = [];
    for (const [docId, score] of scores.entries()) {
      if (score < threshold) {
        continue;
      }

      const document = this.documents.get(docId);
      if (!document) {
        continue;
      }

      // Apply filters if provided
      if (filters) {
        let passesFilters = true;
        for (const [key, value] of Object.entries(filters)) {
          if (document.metadata?.[key] !== value) {
            passesFilters = false;
            break;
          }
        }
        if (!passesFilters) {
          continue;
        }
      }

      results.push({
        id: docId,
        score,
        matches: matches.get(docId) || [],
        metadata: document.metadata || {},
      });
    }

    // Sort by score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Get index statistics
   */
  getStatistics(): IndexStatistics {
    return {
      documentCount: this.totalDocuments,
      totalTerms: this.totalTerms,
      uniqueTerms: this.documentFrequency.size,
      averageDocumentLength: this.averageDocumentLength,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Clear all documents from the index
   */
  async clear(): Promise<void> {
    this.documents.clear();
    this.documentTerms.clear();
    this.termFrequency.clear();
    this.documentFrequency.clear();
    this.documentLengths.clear();
    this.totalDocuments = 0;
    this.totalTerms = 0;
    this.averageDocumentLength = 0;

    if (this.options.persistIndex) {
      await this.saveIndex();
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(): Promise<void> {
    try {
      const indexDir = this.options.indexDir;
      await fs.mkdir(indexDir, { recursive: true });

      const indexData = {
        documents: Array.from(this.documents.entries()),
        documentTerms: Array.from(this.documentTerms.entries()),
        termFrequency: Array.from(this.termFrequency.entries()).map(([term, docMap]) => [
          term,
          Array.from(docMap.entries())
        ]),
        documentFrequency: Array.from(this.documentFrequency.entries()),
        documentLengths: Array.from(this.documentLengths.entries()),
        totalDocuments: this.totalDocuments,
        averageDocumentLength: this.averageDocumentLength,
        totalTerms: this.totalTerms,
        lastUpdated: new Date().toISOString(),
      };

      await fs.writeFile(this.indexFilePath, JSON.stringify(indexData, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[BM25Engine] Failed to save index: ${error}`);
    }
  }

  /**
   * Load index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      if (!existsSync(this.indexFilePath)) {
        return;
      }

      const content = await fs.readFile(this.indexFilePath, 'utf-8');
      const indexData = JSON.parse(content);

      // Restore data structures
      this.documents = new Map(indexData.documents);
      this.documentTerms = new Map(indexData.documentTerms);
      this.documentLengths = new Map(indexData.documentLengths);
      this.documentFrequency = new Map(indexData.documentFrequency);
      this.totalDocuments = indexData.totalDocuments;
      this.averageDocumentLength = indexData.averageDocumentLength;
      this.totalTerms = indexData.totalTerms;

      // Restore term frequency map
      this.termFrequency = new Map();
      for (const [term, docEntries] of indexData.termFrequency) {
        this.termFrequency.set(term, new Map(docEntries));
      }
    } catch (error) {
      console.error(`[BM25Engine] Failed to load index: ${error}`);
      // Initialize empty structures instead of clearing (which would write to disk)
      this.documents = new Map();
      this.documentTerms = new Map();
      this.termFrequency = new Map();
      this.documentFrequency = new Map();
      this.documentLengths = new Map();
      this.totalDocuments = 0;
      this.averageDocumentLength = 0;
      this.totalTerms = 0;
    }
  }

  /**
   * Update average document length
   */
  private updateAverageDocumentLength(): void {
    if (this.totalDocuments === 0) {
      this.averageDocumentLength = 0;
      return;
    }

    let totalLength = 0;
    for (const length of this.documentLengths.values()) {
      totalLength += length;
    }
    this.averageDocumentLength = totalLength / this.totalDocuments;
  }

  /**
   * Get similar documents based on term overlap
   */
  getSimilarDocuments(documentId: string, limit: number = 5): BM25Result[] {
    const document = this.documents.get(documentId);
    if (!document) {
      return [];
    }

    const terms = this.documentTerms.get(documentId);
    if (!terms) {
      return [];
    }

    // Use terms as query to find similar documents
    const query = terms.join(' ');
    const results = this.search(query, {
      limit: limit + 1, // +1 to include the document itself
      threshold: 0.1,
    });

    // Remove the original document from results
    return results.filter(result => result.id !== documentId).slice(0, limit);
  }
}