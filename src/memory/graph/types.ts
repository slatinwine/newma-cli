/**
 * Memory Graph - Type Definitions
 *
 * Defines the structure for the memory association graph
 */

/**
 * Relation types between memory nodes
 */
export type RelationType =
  | 'caused'          // Error -> Cause of the error
  | 'solved_by'       // Error -> Solution that resolved it
  | 'produced'        // Execution -> Files/changes produced
  | 'reasoned_for'    // Reasoning chain -> Task it was for
  | 'evolved_into'    // Experience -> Skill that was created
  | 'related_to'      // Generic relationship
  | 'followed_by'     // Temporal sequence
  | 'part_of'         // Hierarchical relationship
  | 'similar_to'      // Similarity relationship
  | 'contradicts';    // Contradictory information

/**
 * Memory node types that can exist in the graph
 */
export type MemoryNodeType =
  | 'error'
  | 'execution'
  | 'reasoning'
  | 'skill'
  | 'session'
  | 'context'
  | 'preference';

/**
 * Memory graph node
 */
export interface MemoryNode {
  /**
   * Unique node identifier
   */
  id: string;

  /**
   * Node type (which memory system it belongs to)
   */
  type: MemoryNodeType;

  /**
   * Source ID in the original memory manager
   */
  sourceId: string;

  /**
   * Node label/title for display
   */
  label: string;

  /**
   * Optional vector embedding (for future ML-based features)
   */
  embedding?: number[];

  /**
   * When this memory was created
   */
  createdAt: string;

  /**
   * When this node was last updated
   */
  updatedAt: string;

  /**
   * Additional metadata
   */
  metadata: Record<string, any>;

  /**
   * Importance score (0-1), can be boosted by user
   */
  importance?: number;
}

/**
 * Memory graph edge (relationship)
 */
export interface MemoryEdge {
  /**
   * Unique edge identifier
   */
  id: string;

  /**
   * Source node ID
   */
  from: string;

  /**
   * Target node ID
   */
  to: string;

  /**
   * Relationship type
   */
  type: RelationType;

  /**
   * Edge weight/strength (0-1)
   */
  weight: number;

  /**
   * When this relationship was established
   */
  createdAt: string;

  /**
   * Optional description of the relationship
   */
  description?: string;

  /**
   * Additional metadata
   */
  metadata: Record<string, any>;
}

/**
 * Path in the memory graph
 */
export interface GraphPath {
  /**
   * Sequence of node IDs in the path
   */
  nodes: string[];

  /**
   * Sequence of edges in the path
   */
  edges: string[];

  /**
   * Total path weight (sum of edge weights)
   */
  totalWeight: number;

  /**
   * Path length (number of edges)
   */
  length: number;
}

/**
 * Graph traversal options
 */
export interface TraversalOptions {
  /**
   * Maximum depth to traverse
   */
  maxDepth?: number;

  /**
   * Filter by relation types
   */
  relationTypes?: RelationType[];

  /**
   * Filter by node types
   */
  nodeTypes?: MemoryNodeType[];

  /**
   * Whether to include cycles in traversal
   */
  allowCycles?: boolean;

  /**
   * Maximum number of nodes to visit
   */
  maxNodes?: number;
}

/**
 * Graph query options
 */
export interface GraphQueryOptions {
  /**
   * Filter by node types
   */
  types?: MemoryNodeType[];

  /**
   * Filter by relation types
   */
  relations?: RelationType[];

  /**
   * Minimum importance threshold
   */
  minImportance?: number;

  /**
   * Time range filter
   */
  timeRange?: {
    start?: string;
    end?: string;
  };

  /**
   * Metadata filters
   */
  filters?: Record<string, any>;
}

/**
 * Graph statistics
 */
export interface GraphStatistics {
  /**
   * Total number of nodes
   */
  nodeCount: number;

  /**
   * Total number of edges
   */
  edgeCount: number;

  /**
   * Number of nodes by type
   */
  nodesByType: Record<MemoryNodeType, number>;

  /**
   * Number of edges by type
   */
  edgesByType: Record<RelationType, number>;

  /**
   * Average node degree (connections per node)
   */
  averageDegree: number;

  /**
   * Number of connected components
   */
  components: number;

  /**
   * Graph density (actual edges / possible edges)
   */
  density: number;
}

/**
 * Neighbors query result
 */
export interface NeighborResult {
  /**
   * The neighboring node
   */
  node: MemoryNode;

  /**
   * The edge connecting to this node
   */
  edge: MemoryEdge;

  /**
   * Distance in hops
   */
  distance: number;
}

/**
 * Connection result between two nodes
 */
export interface ConnectionResult {
  /**
   * Whether a connection exists
   */
  connected: boolean;

  /**
   * Shortest path if connected
   */
  path?: GraphPath;

  /**
   * Distance in hops
   */
  distance: number;
}