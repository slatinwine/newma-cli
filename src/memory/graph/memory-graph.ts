/**
 * Memory Graph - Core Implementation
 *
 * Adjacency list-based graph storage for memory associations
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  MemoryNode,
  MemoryEdge,
  RelationType,
  MemoryNodeType,
  GraphStatistics,
  GraphQueryOptions,
  ConnectionResult,
} from './types';

/**
 * Memory graph storage data structure
 */
interface GraphStorage {
  nodes: Record<string, MemoryNode>;
  edges: Record<string, MemoryEdge>;
  adjacency: Record<string, Set<string>>; // nodeId -> Set of neighbor nodeIds
  reverseAdjacency: Record<string, Set<string>>; // nodeId -> Set of source nodeIds
  lastUpdated: string;
}

/**
 * Memory Graph Manager
 *
 * Maintains relationships between different memory items
 * using an adjacency list for efficient traversal
 */
export class MemoryGraph {
  private projectRoot: string;
  private graphFile: string;
  private storage: GraphStorage;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.graphFile = join(projectRoot, '.memo', 'graph.json');
    this.storage = {
      nodes: {},
      edges: {},
      adjacency: {},
      reverseAdjacency: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Initialize the memory graph
   */
  async initialize(): Promise<void> {
    const memoDir = join(this.projectRoot, '.memo');
    if (!existsSync(memoDir)) {
      await fs.mkdir(memoDir, { recursive: true });
    }

    await this.loadStorage();
  }

  /**
   * Add a node to the graph
   */
  async addNode(node: MemoryNode): Promise<void> {
    const now = new Date().toISOString();

    // If node exists, update it
    if (this.storage.nodes[node.id]) {
      this.storage.nodes[node.id] = {
        ...this.storage.nodes[node.id],
        ...node,
        updatedAt: now,
      };
    } else {
      // Create new node
      this.storage.nodes[node.id] = {
        ...node,
        createdAt: node.createdAt || now,
        updatedAt: now,
      };

      // Initialize adjacency sets
      this.storage.adjacency[node.id] = new Set();
      this.storage.reverseAdjacency[node.id] = new Set();
    }

    await this.saveStorage();
  }

  /**
   * Remove a node from the graph
   */
  async removeNode(nodeId: string): Promise<void> {
    if (!this.storage.nodes[nodeId]) {
      return;
    }

    // Remove all edges connected to this node
    const edgesToRemove: string[] = [];

    // Check outgoing edges
    for (const neighborId of this.storage.adjacency[nodeId] || []) {
      for (const edgeId of Object.keys(this.storage.edges)) {
        const edge = this.storage.edges[edgeId];
        if (edge.from === nodeId) {
          edgesToRemove.push(edgeId);
        }
      }
    }

    // Check incoming edges
    for (const sourceId of this.storage.reverseAdjacency[nodeId] || []) {
      for (const edgeId of Object.keys(this.storage.edges)) {
        const edge = this.storage.edges[edgeId];
        if (edge.to === nodeId) {
          edgesToRemove.push(edgeId);
        }
      }
    }

    // Remove edges
    for (const edgeId of edgesToRemove) {
      await this.removeEdge(edgeId);
    }

    // Remove node from storage
    delete this.storage.nodes[nodeId];
    delete this.storage.adjacency[nodeId];
    delete this.storage.reverseAdjacency[nodeId];

    await this.saveStorage();
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): MemoryNode | null {
    return this.storage.nodes[nodeId] || null;
  }

  /**
   * Query nodes based on criteria
   */
  queryNodes(options: GraphQueryOptions = {}): MemoryNode[] {
    let nodes = Object.values(this.storage.nodes);

    // Filter by type
    if (options.types && options.types.length > 0) {
      nodes = nodes.filter(node => options.types!.includes(node.type));
    }

    // Filter by importance
    if (options.minImportance !== undefined) {
      nodes = nodes.filter(node =>
        (node.importance || 0) >= options.minImportance!
      );
    }

    // Filter by time range
    if (options.timeRange) {
      nodes = nodes.filter(node => {
        const nodeTime = new Date(node.createdAt);
        if (options.timeRange!.start && nodeTime < new Date(options.timeRange!.start)) {
          return false;
        }
        if (options.timeRange!.end && nodeTime > new Date(options.timeRange!.end)) {
          return false;
        }
        return true;
      });
    }

    // Filter by metadata
    if (options.filters) {
      nodes = nodes.filter(node => {
        for (const [key, value] of Object.entries(options.filters!)) {
          if (node.metadata[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return nodes;
  }

  /**
   * Add an edge between two nodes
   */
  async addEdge(edge: MemoryEdge): Promise<void> {
    // Ensure both nodes exist
    if (!this.storage.nodes[edge.from] || !this.storage.nodes[edge.to]) {
      throw new Error('Cannot add edge: one or both nodes do not exist');
    }

    // Add edge to storage
    this.storage.edges[edge.id] = edge;

    // Update adjacency lists
    if (!this.storage.adjacency[edge.from]) {
      this.storage.adjacency[edge.from] = new Set();
    }
    this.storage.adjacency[edge.from].add(edge.to);

    if (!this.storage.reverseAdjacency[edge.to]) {
      this.storage.reverseAdjacency[edge.to] = new Set();
    }
    this.storage.reverseAdjacency[edge.to].add(edge.from);

    await this.saveStorage();
  }

  /**
   * Remove an edge
   */
  async removeEdge(edgeId: string): Promise<void> {
    const edge = this.storage.edges[edgeId];
    if (!edge) {
      return;
    }

    // Remove from adjacency lists
    this.storage.adjacency[edge.from]?.delete(edge.to);
    this.storage.reverseAdjacency[edge.to]?.delete(edge.from);

    // Remove edge from storage
    delete this.storage.edges[edgeId];

    await this.saveStorage();
  }

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): MemoryEdge | null {
    return this.storage.edges[edgeId] || null;
  }

  /**
   * Get all edges between two nodes
   */
  getEdgesBetween(nodeId1: string, nodeId2: string): MemoryEdge[] {
    return Object.values(this.storage.edges).filter(edge =>
      (edge.from === nodeId1 && edge.to === nodeId2) ||
      (edge.from === nodeId2 && edge.to === nodeId1)
    );
  }

  /**
   * Query edges based on criteria
   */
  queryEdges(options: GraphQueryOptions = {}): MemoryEdge[] {
    let edges = Object.values(this.storage.edges);

    // Filter by relation types
    if (options.relations && options.relations.length > 0) {
      edges = edges.filter(edge => options.relations!.includes(edge.type));
    }

    // Filter by node types
    if (options.types && options.types.length > 0) {
      edges = edges.filter(edge => {
        const fromNode = this.storage.nodes[edge.from];
        const toNode = this.storage.nodes[edge.to];
        return fromNode && toNode &&
          options.types!.includes(fromNode.type) &&
          options.types!.includes(toNode.type);
      });
    }

    // Filter by metadata
    if (options.filters) {
      edges = edges.filter(edge => {
        for (const [key, value] of Object.entries(options.filters!)) {
          if (edge.metadata[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return edges;
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId: string): Array<{ node: MemoryNode; edge: MemoryEdge }> {
    const neighbors: Array<{ node: MemoryNode; edge: MemoryEdge }> = [];
    const neighborIds = this.storage.adjacency[nodeId] || new Set();

    for (const neighborId of neighborIds) {
      const node = this.storage.nodes[neighborId];
      if (!node) {
        continue;
      }

      // Find the edge connecting these nodes
      const edge = Object.values(this.storage.edges).find(e =>
        e.from === nodeId && e.to === neighborId
      );

      if (edge) {
        neighbors.push({ node, edge });
      }
    }

    return neighbors;
  }

  /**
   * Check if two nodes are connected
   */
  areConnected(nodeId1: string, nodeId2: string): boolean {
    const neighbors = this.storage.adjacency[nodeId1] || new Set();
    return neighbors.has(nodeId2);
  }

  /**
   * Get graph statistics
   */
  getStatistics(): GraphStatistics {
    const nodes = Object.values(this.storage.nodes);
    const edges = Object.values(this.storage.edges);

    // Count nodes by type
    const nodesByType: Record<MemoryNodeType, number> = {
      error: 0,
      execution: 0,
      reasoning: 0,
      skill: 0,
      session: 0,
      context: 0,
      preference: 0,
    };

    for (const node of nodes) {
      nodesByType[node.type]++;
    }

    // Count edges by type
    const edgesByType: Record<string, number> = {};
    for (const edge of edges) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }

    // Calculate average degree
    let totalDegree = 0;
    for (const nodeId of Object.keys(this.storage.nodes)) {
      totalDegree += (this.storage.adjacency[nodeId]?.size || 0);
    }
    const averageDegree = nodes.length > 0 ? totalDegree / nodes.length : 0;

    // Calculate number of connected components using BFS
    const components = this.calculateConnectedComponents();

    // Calculate graph density
    const maxPossibleEdges = nodes.length * (nodes.length - 1) / 2;
    const density = maxPossibleEdges > 0 ? edges.length / maxPossibleEdges : 0;

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodesByType,
      edgesByType: edgesByType as Record<RelationType, number>,
      averageDegree,
      components,
      density,
    };
  }

  /**
   * Clear all nodes and edges
   */
  async clear(): Promise<void> {
    this.storage = {
      nodes: {},
      edges: {},
      adjacency: {},
      reverseAdjacency: {},
      lastUpdated: new Date().toISOString(),
    };

    await this.saveStorage();
  }

  /**
   * Get all nodes
   */
  getAllNodes(): MemoryNode[] {
    return Object.values(this.storage.nodes);
  }

  /**
   * Get all edges
   */
  getAllEdges(): MemoryEdge[] {
    return Object.values(this.storage.edges);
  }

  /**
   * Find path between two nodes (using BFS)
   */
  findPath(fromNodeId: string, toNodeId: string): ConnectionResult {
    if (!this.storage.nodes[fromNodeId] || !this.storage.nodes[toNodeId]) {
      return {
        connected: false,
        distance: -1,
      };
    }

    if (fromNodeId === toNodeId) {
      return {
        connected: true,
        distance: 0,
        path: {
          nodes: [fromNodeId],
          edges: [],
          totalWeight: 0,
          length: 0,
        },
      };
    }

    // BFS to find shortest path
    const queue: Array<{ nodeId: string; path: string[]; edges: string[]; weight: number }> = [];
    const visited = new Set<string>();

    queue.push({
      nodeId: fromNodeId,
      path: [fromNodeId],
      edges: [],
      weight: 0,
    });

    visited.add(fromNodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Get neighbors
      const neighbors = this.storage.adjacency[current.nodeId] || new Set();

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) {
          continue;
        }

        visited.add(neighborId);

        // Find the edge
        const edge = Object.values(this.storage.edges).find(e =>
          e.from === current.nodeId && e.to === neighborId
        );

        const edgeId = edge?.id || '';
        const newWeight = current.weight + (edge?.weight || 0);

        const newPath = {
          nodeId: neighborId,
          path: [...current.path, neighborId],
          edges: [...current.edges, edgeId],
          weight: newWeight,
        };

        if (neighborId === toNodeId) {
          return {
            connected: true,
            distance: newPath.path.length - 1,
            path: {
              nodes: newPath.path,
              edges: newPath.edges,
              totalWeight: newPath.weight,
              length: newPath.path.length - 1,
            },
          };
        }

        queue.push(newPath);
      }
    }

    return {
      connected: false,
      distance: -1,
    };
  }

  /**
   * Save graph to disk
   */
  private async saveStorage(): Promise<void> {
    try {
      this.storage.lastUpdated = new Date().toISOString();

      // Convert Sets to Arrays for JSON serialization
      const serializable = {
        nodes: this.storage.nodes,
        edges: this.storage.edges,
        adjacency: Object.fromEntries(
          Object.entries(this.storage.adjacency).map(([k, v]) => [k, Array.from(v)])
        ),
        reverseAdjacency: Object.fromEntries(
          Object.entries(this.storage.reverseAdjacency).map(([k, v]) => [k, Array.from(v)])
        ),
        lastUpdated: this.storage.lastUpdated,
      };

      await fs.writeFile(this.graphFile, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[MemoryGraph] Failed to save: ${error}`);
    }
  }

  /**
   * Load graph from disk
   */
  private async loadStorage(): Promise<void> {
    try {
      if (!existsSync(this.graphFile)) {
        return;
      }

      const content = await fs.readFile(this.graphFile, 'utf-8');
      const data = JSON.parse(content);

      // Convert Arrays back to Sets
      this.storage = {
        nodes: data.nodes || {},
        edges: data.edges || {},
        adjacency: Object.fromEntries(
          Object.entries(data.adjacency || {}).map(([k, v]) => [k, new Set(v as string[])])
        ),
        reverseAdjacency: Object.fromEntries(
          Object.entries(data.reverseAdjacency || {}).map(([k, v]) => [k, new Set(v as string[])])
        ),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[MemoryGraph] Failed to load: ${error}`);
      this.storage = {
        nodes: {},
        edges: {},
        adjacency: {},
        reverseAdjacency: {},
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate number of connected components using BFS
   */
  private calculateConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;

    for (const nodeId of Object.keys(this.storage.nodes)) {
      if (!visited.has(nodeId)) {
        components++;
        this.bfsVisit(nodeId, visited);
      }
    }

    return components;
  }

  /**
   * BFS to mark all nodes in a component as visited
   */
  private bfsVisit(startNodeId: string, visited: Set<string>): void {
    const queue = [startNodeId];
    visited.add(startNodeId);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      for (const neighborId of this.storage.adjacency[nodeId] || new Set()) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
  }
}