declare module 'lru-cache' {
  interface LRUCacheOptions<K, V> {
    max?: number;
    ttl?: number;
    updateAgeOnGet?: boolean;
    updateAgeOnHas?: boolean;
    sizeCalculation?: (value: V) => number;
  }

  class LRUCache<K, V> {
    constructor(options: LRUCacheOptions<K, V>);
    get(key: K): V | undefined;
    set(key: K, value: V): this;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    size: number;
    entries(): IterableIterator<[K, V]>;
  }

  export { LRUCache, LRUCacheOptions };
}
