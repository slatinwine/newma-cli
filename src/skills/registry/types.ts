/**
 * Registry Types
 */

export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  versions: string[];
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  downloads?: number;
  rating?: number;
  packageUrl: string;
}

export interface RegistrySearchOptions {
  query?: string;
  category?: string;
  tag?: string;
  minRating?: number;
  sortBy?: 'relevance' | 'name' | 'version' | 'downloads' | 'rating';
  limit?: number;
  offset?: number;
}

export interface RegistrySearchResult {
  total: number;
  results: RegistryEntry[];
  hasMore: boolean;
  nextOffset?: number;
}
