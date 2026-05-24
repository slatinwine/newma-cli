/**
 * Skills Registry
 * Manages skill package registry for distribution
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  RegistryEntry,
  RegistrySearchOptions,
  RegistrySearchResult,
} from './types';
import type { SkillPackage } from '../types';

/**
 * Local registry directory
 */
const REGISTRY_DIR = path.join(os.homedir(), '.kode', 'registry');

/**
 * Registry cache file
 */
const CACHE_FILE = path.join(REGISTRY_DIR, 'cache.json');

/**
 * Registry cache structure
 */
interface RegistryCache {
  version: string;
  lastUpdate: string;
  entries: RegistryEntry[];
}

/**
 * Initialize local registry
 */
export async function initRegistry(): Promise<void> {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });

  const cacheExists = await fileExists(CACHE_FILE);
  if (!cacheExists) {
    await writeCache({
      version: '1.0.0',
      lastUpdate: new Date().toISOString(),
      entries: [],
    });
  }
}

/**
 * Add skill to registry
 */
export async function addToRegistry(
  packageFile: string,
  options: {
    /** Override package URL */
    packageUrl?: string;
    /** Make public */
    public?: boolean;
  } = {}
): Promise<RegistryEntry> {
  await initRegistry();

  // Read package metadata
  const cache = await readCache();

  // Extract package info
  const { skillId, version } = extractPackageInfo(packageFile);

  // Check if entry exists
  const existingEntry = cache.entries.find(e => e.id === skillId);

  if (existingEntry) {
    // Add version if not exists
    if (!existingEntry.versions.includes(version)) {
      existingEntry.versions.push(version);
      existingEntry.latestVersion = getLatestVersion(existingEntry.versions);
    }

    await writeCache(cache);
    return existingEntry;
  }

  // Create new entry
  const entry: RegistryEntry = {
    id: skillId,
    name: skillId,
    description: '',
    latestVersion: version,
    versions: [version],
    keywords: [],
    packageUrl: options.packageUrl || `file://${packageFile}`,
  };

  cache.entries.push(entry);
  await writeCache(cache);

  return entry;
}

/**
 * Search registry
 */
export async function searchRegistry(
  options: RegistrySearchOptions = {}
): Promise<RegistrySearchResult> {
  await initRegistry();

  const cache = await readCache();
  let results = cache.entries;

  // Apply filters
  if (options.query) {
    const query = options.query.toLowerCase();
    results = results.filter(entry =>
      entry.name.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query) ||
      entry.keywords.some(k => k.toLowerCase().includes(query))
    );
  }

  if (options.category) {
    results = results.filter(entry =>
      entry.description.toLowerCase().includes(options.category!.toLowerCase())
    );
  }

  if (options.tag) {
    results = results.filter(entry =>
      entry.keywords.includes(options.tag!)
    );
  }

  if (options.minRating) {
    results = results.filter(entry =>
      (entry.rating || 0) >= options.minRating!
    );
  }

  // Sort results
  results = sortResults(results, options.sortBy || 'relevance');

  // Pagination
  const offset = options.offset || 0;
  const limit = options.limit || 20;
  const paginatedResults = results.slice(offset, offset + limit);

  return {
    total: results.length,
    results: paginatedResults,
    hasMore: offset + limit < results.length,
    nextOffset: offset + limit < results.length ? offset + limit : undefined,
  };
}

/**
 * Get skill from registry
 */
export async function getFromRegistry(skillId: string): Promise<RegistryEntry | null> {
  await initRegistry();

  const cache = await readCache();
  return cache.entries.find(e => e.id === skillId) || null;
}

/**
 * Remove from registry
 */
export async function removeFromRegistry(skillId: string): Promise<boolean> {
  await initRegistry();

  const cache = await readCache();
  const initialLength = cache.entries.length;
  cache.entries = cache.entries.filter(e => e.id !== skillId);

  if (cache.entries.length < initialLength) {
    await writeCache(cache);
    return true;
  }

  return false;
}

/**
 * List all skills in registry
 */
export async function listRegistry(): Promise<RegistryEntry[]> {
  await initRegistry();
  const cache = await readCache();
  return cache.entries;
}

/**
 * Update registry cache (fetch from remote)
 */
export async function updateRegistry(): Promise<void> {
  // Placeholder for fetching from remote registry
  // In production, this would fetch from a central server
  await initRegistry();

  const cache = await readCache();
  cache.lastUpdate = new Date().toISOString();
  await writeCache(cache);
}

/**
 * Read cache from file
 */
async function readCache(): Promise<RegistryCache> {
  try {
    const content = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      version: '1.0.0',
      lastUpdate: new Date().toISOString(),
      entries: [],
    };
  }
}

/**
 * Write cache to file
 */
async function writeCache(cache: RegistryCache): Promise<void> {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract package info from package file
 */
function extractPackageInfo(packageFile: string): {
  skillId: string;
  version: string;
} {
  const basename = path.basename(packageFile);
  const match = basename.match(/^(.+?)-(\d+\.\d+\.\d+)\.kode\.tar\.gz$/);

  if (match) {
    return {
      skillId: match[1],
      version: match[2],
    };
  }

  // Fallback: parse from filename
  const parts = basename.replace('.kode.tar.gz', '').split('-');
  const version = parts.pop();

  return {
    skillId: parts.join('-'),
    version: version || '1.0.0',
  };
}

/**
 * Get latest version from version list
 */
function getLatestVersion(versions: string[]): string {
  return versions.sort((a, b) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if ((aParts[i] || 0) > (bParts[i] || 0)) return 1;
      if ((aParts[i] || 0) < (bParts[i] || 0)) return -1;
    }

    return 0;
  }).pop() || '1.0.0';
}

/**
 * Sort results by field
 */
function sortResults(results: RegistryEntry[], sortBy: string): RegistryEntry[] {
  switch (sortBy) {
    case 'name':
      return results.sort((a, b) => a.name.localeCompare(b.name));

    case 'version':
      return results.sort((a, b) =>
        b.latestVersion.localeCompare(a.latestVersion, undefined, { numeric: true })
      );

    case 'downloads':
      return results.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

    case 'rating':
      return results.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    case 'relevance':
    default:
      return results;
  }
}
