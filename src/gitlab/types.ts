// src/gitlab/types.ts
/**
 * GitLab CI/CD Integration Type Definitions
 */

/**
 * GitLab merge request webhook event
 */
export interface MergeRequestEvent {
  object_kind: string;
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
  };
  project: {
    id: number;
    name: string;
    web_url: string;
    default_branch: string;
  };
  object_attributes: {
    id: number;
    iid: number;
    title: string;
    description: string;
    source_branch: string;
    target_branch: string;
    state: string;
    action: string;
    author_id: number;
    url: string;
    source: {
      name: string;
      description: string;
      web_url: string;
      default_branch: string;
    };
    target: {
      name: string;
      description: string;
      web_url: string;
      default_branch: string;
    };
    last_commit: {
      id: string;
      message: string;
      timestamp: string;
      url: string;
      author: {
        name: string;
        email: string;
      };
    };
    work_in_progress: boolean;
    total_time_spent: number;
    time_change: number;
    human_total_time_spent: string;
    human_time_change: string;
    human_time_estimate: string;
    assignee_ids: number[];
    assignee_id: number;
    labels: string[];
    detailed_merge_status: string;
  };
  labels: any[];
  changes: {
    updatedById: {
      previous: number;
      current: number;
    };
    updatedAt: {
      previous: string;
      current: string;
    };
  };
  repository: {
    name: string;
    url: string;
    description: string;
    homepage: string;
    git_http_url: string;
    git_ssh_url: string;
    visibility_level: number;
  };
}

/**
 * GitLab merge request
 */
export interface MergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  target_branch: string;
  source_branch: string;
  author: {
    id: number;
    username: string;
    name: string;
    state: string;
    avatar_url: string;
    web_url: string;
  };
  assignees: any[];
  reviewers: any[];
  source_project_id: number;
  target_project_id: number;
  labels: string[];
  draft: boolean;
  work_in_progress: boolean;
  detailed_merge_status: string;
  web_url: string;
  diff_refs: {
    base_sha: string;
    head_sha: string;
    start_sha: string;
  };
  merge_status: string;
}

/**
 * GitLab diff file
 */
export interface DiffFile {
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  old_path: string;
  new_path: string;
  a_mode: string;
  b_mode: string;
  blob_id: string;
}

/**
 * GitLab note (comment)
 */
export interface Note {
  id: number;
  type: string | null;
  body: string;
  author: {
    id: number;
    username: string;
    name: string;
    state: string;
    avatar_url: string;
    web_url: string;
  };
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_id: number;
  noteable_type: string;
  noteable_iid: number | null;
  resolvable: boolean;
  confidential: boolean;
}

/**
 * GitLab configuration
 */
export interface GitLabConfig {
  url: string;
  token: string;
  projectId?: number;
  mergeRequestId?: number;
  maxFiles?: number;
  maxLinesPerFile?: number;
  autoFix?: boolean;
  dryRun?: boolean;
}

/**
 * Review issue severity
 */
export type ReviewSeverity = 'error' | 'warning' | 'info';

/**
 * Review issue category
 */
export type ReviewCategory = 'bug' | 'security' | 'performance' | 'architecture' | 'suggestion' | 'style';

/**
 * Review issue
 */
export interface ReviewIssue {
  file: string;
  line: number;
  severity: ReviewSeverity;
  category: ReviewCategory;
  message: string;
  suggestion?: string;
  code?: string;
}

/**
 * Review result
 */
export interface ReviewResult {
  issues: ReviewIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    byCategory: Record<ReviewCategory, number>;
  };
}

/**
 * Review status
 */
export interface ReviewStatus {
  reviewed: boolean;
  timestamp: string;
  issuesCount: number;
  autoFixed: number;
}

/**
 * AI review request
 */
export interface AIReviewRequest {
  projectInfo: Record<string, string>;
  diff: string;
  fileName: string;
  language: string;
}

/**
 * AI review response
 */
export interface AIReviewResponse {
  issues: Array<{
    line: number;
    severity: ReviewSeverity;
    category: ReviewCategory;
    message: string;
    suggestion?: string;
    code?: string;
  }>;
}