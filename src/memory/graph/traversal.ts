/**
 * Memory Graph - Traversal Algorithms
 *
 * Provides BFS and DFS traversal algorithms for the memory graph
 */

import { MemoryGraph } from './memory-graph';
import {
  MemoryNode,
  MemoryEdge,
  TraversalOptions,
  GraphPath,
  NeighborResult,
  RelationType,
  MemoryNodeType,
} from './types';

/**
 * Traversal result
 */
export interface TraversalResult {
  /**
   * Nodes visited in order
   */
  nodes: MemoryNode[];

  /**
   * Edges traversed
   */
  edges: MemoryEdge[];

  /**
   * Visit order (node IDs)
   */
  visitOrder: string[];

  /**
   * Statistics
   */
  stats: {
    nodesVisited: number;
    edgesTraversed: number;
    maxDepth: number;
  };
}

/**
 * Graph traversal utilities
 */
export class GraphTraversal {
  constructor(private graph: MemoryGraph) {}

  /**
   * Breadth-First Search (BFS) traversal from a starting node
   */
  bfs(
    startNodeId: string,
    options: TraversalOptions = {}
  ): TraversalResult {
    const result: TraversalResult = {
      nodes: [],
      edges: [],
      visitOrder: [],
      stats: {
        nodesVisited: 0,
        edgesTraversed: 0,
        maxDepth: 0,
      },
    };

    const startNode = this.graph.getNode(startNodeId);
    if (!startNode) {
      return result;
    }

    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startNodeId, depth: 0 }];
    const visited = new Set<string>();
    const visitedEdges = new Set<string>();

    const maxDepth = options.maxDepth ?? Infinity;
    const maxNodes = options.maxNodes ?? Infinity;
    const allowedRelations = options.relationTypes ?
      new Set(options.relationTypes) : null;
    const allowedNodeTypes = options.nodeTypes ?
      new Set(options.nodeTypes) : null;

    while (queue.length > 0 && result.nodes.length < maxNodes) {
      const { nodeId, depth } = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }

      // Check depth limit
      if (depth > maxDepth) {
        continue;
      }

      visited.add(nodeId);
      const node = this.graph.getNode(nodeId);
      if (!node) {
        continue;
      }

      // Check node type filter
      if (allowedNodeTypes && !allowedNodeTypes.has(node.type)) {
        continue;
      }

      result.nodes.push(node);
      result.visitOrder.push(nodeId);
      result.stats.nodesVisited++;
      result.stats.maxDepth = Math.max(result.stats.maxDepth, depth);

      // Get neighbors
      const neighbors = this.graph.getNeighbors(nodeId);

      for (const { node: neighborNode, edge } of neighbors) {
        // Check relation type filter
        if (allowedRelations && !allowedRelations.has(edge.type)) {
          continue;
        }

        // Check node type filter for neighbor
        if (allowedNodeTypes && !allowedNodeTypes.has(neighborNode.type)) {
          continue;
        }

        // Track edge if not already visited
        if (!visitedEdges.has(edge.id)) {
          visitedEdges.add(edge.id);
          result.edges.push(edge);
          result.stats.edgesTraversed++;
        }

        // Add to queue if not visited
        if (!visited.has(neighborNode.id)) {
          queue.push({ nodeId: neighborNode.id, depth: depth + 1 });
        }
      }

      // Check if we should continue (cycle prevention)
      if (!options.allowCycles && result.nodes.length >= Object.keys(this.graph.getAllNodes()).length) {
        break;
      }
    }

    return result;
  }

  /**
   * Depth-First Search (DFS) traversal from a starting node
   */
  dfs(
    startNodeId: string,
    options: TraversalOptions = {}
  ): TraversalResult {
    const result: TraversalResult = {
      nodes: [],
      edges: [],
      visitOrder: [],
      stats: {
        nodesVisited: 0,
        edgesTraversed: 0,
        maxDepth: 0,
      },
    };

    const startNode = this.graph.getNode(startNodeId);
    if (!startNode) {
      return result;
    }

    const visited = new Set<string>();
    const visitedEdges = new Set<string>();

    const maxDepth = options.maxDepth ?? Infinity;
    const maxNodes = options.maxNodes ?? Infinity;
    const allowedRelations = options.relationTypes ?
      new Set(options.relationTypes) : null;
    const allowedNodeTypes = options.nodeTypes ?
      new Set(options.nodeTypes) : null;

    const dfsVisit = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) {
        return;
      }

      if (depth > maxDepth || result.nodes.length >= maxNodes) {
        return;
      }

      visited.add(nodeId);
      const node = this.graph.getNode(nodeId);
      if (!node) {
        return;
      }

      // Check node type filter
      if (allowedNodeTypes && !allowedNodeTypes.has(node.type)) {
        return;
      }

      result.nodes.push(node);
      result.visitOrder.push(nodeId);
      result.stats.nodesVisited++;
      result.stats.maxDepth = Math.max(result.stats.maxDepth, depth);

      // Get neighbors
      const neighbors = this.graph.getNeighbors(nodeId);

      for (const { node: neighborNode, edge } of neighbors) {
        // Check relation type filter
        if (allowedRelations && !allowedRelations.has(edge.type)) {
          continue;
        }

        // Check node type filter for neighbor
        if (allowedNodeTypes && !allowedNodeTypes.has(neighborNode.type)) {
          continue;
        }

        // Track edge if not already visited
        if (!visitedEdges.has(edge.id)) {
          visitedEdges.add(edge.id);
          result.edges.push(edge);
          result.stats.edgesTraversed++;
        }

        // Recursively visit neighbor
        dfsVisit(neighborNode.id, depth + 1);

        // Check if we've hit the limit
        if (result.nodes.length >= maxNodes) {
          break;
        }
      }
    };

    dfsVisit(startNodeId, 0);

    return result;
  }

  /**
   * Find all paths between two nodes using DFS
   */
  findAllPaths(
    fromNodeId: string,
    toNodeId: string,
    options: {
      maxLength?: number;
      allowCycles?: boolean;
      maxPaths?: number;
    } = {}
  ): GraphPath[] {
    const paths: GraphPath[] = [];
    const maxLength = options.maxLength ?? 10;
    const maxPaths = options.maxPaths ?? 100;

    const fromNode = this.graph.getNode(fromNodeId);
    const toNode = this.graph.getNode(toNodeId);

    if (!fromNode || !toNode) {
      return paths;
    }

    const dfsPath = (
      currentNodeId: string,
      targetNodeId: string,
      currentPath: string[],
      currentEdges: string[],
      currentWeight: number,
      visited: Set<string>
    ) => {
      // Check if we found a path
      if (currentNodeId === targetNodeId) {
        paths.push({
          nodes: [...currentPath],
          edges: [...currentEdges],
          totalWeight: currentWeight,
          length: currentPath.length - 1,
        });
        return;
      }

      // Check length limit
      if (currentPath.length - 1 >= maxLength) {
        return;
      }

      // Check if we've found enough paths
      if (paths.length >= maxPaths) {
        return;
      }

      // Get neighbors
      const neighbors = this.graph.getNeighbors(currentNodeId);

      for (const { node: neighbor, edge } of neighbors) {
        // Skip if already visited (unless cycles allowed)
        if (visited.has(neighbor.id) && !options.allowCycles) {
          continue;
        }

        // Add to visited set
        visited.add(neighbor.id);

        // Recursively search
        dfsPath(
          neighbor.id,
          targetNodeId,
          [...currentPath, neighbor.id],
          [...currentEdges, edge.id],
          currentWeight + edge.weight,
          visited
        );

        // Remove from visited set for backtracking
        visited.delete(neighbor.id);
      }
    };

    // Start DFS from source node
    dfsPath(fromNodeId, toNodeId, [fromNodeId], [], 0, new Set([fromNodeId]));

    // Sort paths by length and weight
    paths.sort((a, b) => {
      if (a.length !== b.length) {
        return a.length - b.length; // Shorter paths first
      }
      return a.totalWeight - b.totalWeight; // Then by weight
    });

    return paths;
  }

  /**
   * Find shortest path between two nodes using BFS
   */
  findShortestPath(fromNodeId: string, toNodeId: string): GraphPath | null {
    const connection = this.graph.findPath(fromNodeId, toNodeId);
    return connection.path || null;
  }

  /**
   * Get neighbors within N hops (with filters)
   */
  getNeighborsWithinHops(
    nodeId: string,
    maxHops: number,
    options: {
      relationTypes?: RelationType[];
      nodeTypes?: MemoryNodeType[];
    } = {}
  ): Map<number, NeighborResult[]> {
    const results = new Map<number, NeighborResult[]>();
    const visited = new Set<string>([nodeId]);
    const currentLevel = new Set<string>([nodeId]);

    const allowedRelations = options.relationTypes ?
      new Set(options.relationTypes) : null;
    const allowedNodeTypes = options.nodeTypes ?
      new Set(options.nodeTypes) : null;

    for (let hop = 1; hop <= maxHops; hop++) {
      const nextLevel = new Set<string>();
      const hopResults: NeighborResult[] = [];

      for (const currentNodeId of currentLevel) {
        const neighbors = this.graph.getNeighbors(currentNodeId);

        for (const { node: neighbor, edge } of neighbors) {
          if (visited.has(neighbor.id)) {
            continue;
          }

          // Check relation type filter
          if (allowedRelations && !allowedRelations.has(edge.type)) {
            continue;
          }

          // Check node type filter
          if (allowedNodeTypes && !allowedNodeTypes.has(neighbor.type)) {
            continue;
          }

          visited.add(neighbor.id);
          nextLevel.add(neighbor.id);

          hopResults.push({
            node: neighbor,
            edge,
            distance: hop,
          });
        }
      }

      if (hopResults.length > 0) {
        results.set(hop, hopResults);
      }

      // Move to next level
      currentLevel.clear();
      nextLevel.forEach(id => currentLevel.add(id));

      // Stop if no more nodes to explore
      if (currentLevel.size === 0) {
        break;
      }
    }

    return results;
  }

  /**
   * Find connected components in the graph
   */
  findConnectedComponents(): MemoryNode[][] {
    const allNodes = this.graph.getAllNodes();
    const visited = new Set<string>();
    const components: MemoryNode[][] = [];

    for (const node of allNodes) {
      if (visited.has(node.id)) {
        continue;
      }

      // Start a new component with BFS
      const component: MemoryNode[] = [];
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const nodeData = this.graph.getNode(nodeId);

        if (nodeData) {
          component.push(nodeData);
        }

        // Add unvisited neighbors to queue
        const neighbors = this.graph.getNeighbors(nodeId);
        for (const { node: neighbor } of neighbors) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor.id);
          }
        }
      }

      if (component.length > 0) {
        components.push(component);
      }
    }

    // Sort components by size (largest first)
    components.sort((a, b) => b.length - a.length);

    return components;
  }

  /**
   * Find nodes with high centrality (many connections)
   */
  findCentralNodes(limit: number = 10): Array<{ node: MemoryNode; degree: number }> {
    const allNodes = this.graph.getAllNodes();
    const nodeDegrees: Array<{ node: MemoryNode; degree: number }> = [];

    for (const node of allNodes) {
      const neighbors = this.graph.getNeighbors(node.id);
      nodeDegrees.push({
        node,
        degree: neighbors.length,
      });
    }

    // Sort by degree (descending)
    nodeDegrees.sort((a, b) => b.degree - a.degree);

    return nodeDegrees.slice(0, limit);
  }

  /**
   * Find bridges (edges whose removal would disconnect the graph)
   */
  findBridges(): MemoryEdge[] {
    const bridges: MemoryEdge[] = [];
    const allEdges = this.graph.getAllEdges();
    const allNodes = this.graph.getAllNodes();

    // For each edge, temporarily remove it and check if graph becomes disconnected
    for (const edge of allEdges) {
      // Check if removing this edge disconnects its endpoints
      const fromNode = this.graph.getNode(edge.from);
      const toNode = this.graph.getNode(edge.to);

      if (!fromNode || !toNode) {
        continue;
      }

      // Get all paths between the endpoints (excluding this edge)
      const paths = this.findAllPaths(edge.from, edge.to, {
        maxLength: 5,
        allowCycles: false,
        maxPaths: 2, // We only need to know if there's at least one alternative path
      });

      // If there's only one path (the direct edge), it's a bridge
      if (paths.length <= 1) {
        bridges.push(edge);
      }
    }

    return bridges;
  }

  /**
   * Find clusters of related nodes using simple label propagation
   */
  findClusters(maxIterations: number = 10): Map<string, MemoryNode[]> {
    const allNodes = this.graph.getAllNodes();
    const labels = new Map<string, string>();

    // Initialize each node with its own label
    for (const node of allNodes) {
      labels.set(node.id, node.id);
    }

    // Propagate labels
    for (let iter = 0; iter < maxIterations; iter++) {
      const newLabels = new Map<string, string>();

      for (const node of allNodes) {
        const neighbors = this.graph.getNeighbors(node.id);

        if (neighbors.length === 0) {
          newLabels.set(node.id, labels.get(node.id)!);
          continue;
        }

        // Count label frequencies among neighbors
        const labelCounts = new Map<string, number>();
        for (const { node: neighbor } of neighbors) {
          const label = labels.get(neighbor.id)!;
          labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
        }

        // Find most frequent label
        let maxCount = 0;
        let dominantLabel = labels.get(node.id)!;

        for (const [label, count] of labelCounts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            dominantLabel = label;
          }
        }

        newLabels.set(node.id, dominantLabel);
      }

      labels.clear();
      for (const [nodeId, label] of newLabels.entries()) {
        labels.set(nodeId, label);
      }
    }

    // Group nodes by their final labels
    const clusters = new Map<string, MemoryNode[]>();
    for (const [nodeId, label] of labels.entries()) {
      if (!clusters.has(label)) {
        clusters.set(label, []);
      }

      const node = this.graph.getNode(nodeId);
      if (node) {
        clusters.get(label)!.push(node);
      }
    }

    return clusters;
  }
}