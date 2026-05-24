// src/gitlab/client.ts
/**
 * GitLab API Client
 * Handles all GitLab API interactions with proxy support
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import { httpsAgent } from '../http-agent';
import {
  GitLabConfig,
  MergeRequest,
  DiffFile,
  Note
} from './types';

/**
 * GitLab API Client
 */
export class GitLabClient {
  private config: GitLabConfig;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: GitLabConfig) {
    this.config = config;
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.headers = {
      'PRIVATE-TOKEN': config.token,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get merge request details
   */
  async getMRDetail(projectId: number, mrIid: number): Promise<MergeRequest> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        agent: this.getAgent(),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to get MR details: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get merge request diff
   */
  async getMRDiff(projectId: number, mrIid: number): Promise<DiffFile[]> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/diff`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        agent: this.getAgent(),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to get MR diff: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get merge request changes (with file contents)
   */
  async getMRChanges(projectId: number, mrIid: number): Promise<{
    changes: DiffFile[];
    source_branch: string;
    target_branch: string;
  }> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/changes`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        agent: this.getAgent(),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return {
        changes: data.changes,
        source_branch: data.source_branch,
        target_branch: data.target_branch,
      };
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to get MR changes: ${error.message}`));
      throw error;
    }
  }

  /**
   * Create a note (comment) on merge request
   */
  async createNote(projectId: number, mrIid: number, body: string): Promise<Note> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/notes`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        agent: this.getAgent(),
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to create note: ${error.message}`));
      throw error;
    }
  }

  /**
   * Reply to an existing note
   */
  async replyToNote(projectId: number, mrIid: number, noteId: number, body: string): Promise<Note> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/notes/${noteId}/notes`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        agent: this.getAgent(),
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to reply to note: ${error.message}`));
      throw error;
    }
  }

  /**
   * Create a discussion on merge request
   */
  async createDiscussion(projectId: number, mrIid: number, body: string, position?: any): Promise<any> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions`;

    try {
      const requestBody: any = { body };
      if (position) {
        requestBody.position = position;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        agent: this.getAgent(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to create discussion: ${error.message}`));
      throw error;
    }
  }

  /**
   * Update merge request status
   */
  async updateMRStatus(projectId: number, mrIid: number, state: 'open' | 'closed'): Promise<MergeRequest> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers,
        agent: this.getAgent(),
        body: JSON.stringify({ state_event: state === 'closed' ? 'close' : 'reopen' }),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to update MR status: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(projectId: number, filePath: string, ref: string): Promise<string> {
    const encodedPath = encodeURIComponent(filePath);
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/repository/files/${encodedPath}?ref=${ref}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        agent: this.getAgent(),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to get file content: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get repository file tree
   */
  async getRepositoryTree(projectId: number, ref: string, path: string = ''): Promise<any[]> {
    const url = `${this.baseUrl}/api/v4/projects/${projectId}/repository/tree?ref=${ref}&path=${encodeURIComponent(path)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        agent: this.getAgent(),
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to get repository tree: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get appropriate HTTP agent (with proxy support)
   */
  private getAgent() {
    return this.baseUrl.startsWith('https') ? httpsAgent : undefined;
  }

  /**
   * Test connection to GitLab API
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/v4/user`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        agent: this.getAgent(),
      });

      if (!response.ok) {
        console.error(chalk.red(`❌ GitLab API connection failed: ${response.status}`));
        return false;
      }

      const user = await response.json();
      console.log(chalk.green(`✅ Connected to GitLab as ${user.username}`));
      return true;
    } catch (error: any) {
      console.error(chalk.red(`❌ GitLab API connection failed: ${error.message}`));
      return false;
    }
  }
}

/**
 * Create GitLab client from environment variables
 */
export function createClientFromEnv(): GitLabClient | null {
  const url = process.env.GITLAB_URL || process.env.CI_SERVER_URL;
  const token = process.env.GITLAB_TOKEN || process.env.GI_JOB_TOKEN;
  const projectId = process.env.CI_PROJECT_ID ? parseInt(process.env.CI_PROJECT_ID) : undefined;
  const mergeRequestId = process.env.CI_MERGE_REQUEST_IID ? parseInt(process.env.CI_MERGE_REQUEST_IID) : undefined;

  if (!url || !token) {
    console.error(chalk.red('❌ Missing required GitLab environment variables'));
    console.error(chalk.yellow('Required: GITLAB_URL and GITLAB_TOKEN'));
    return null;
  }

  const config: GitLabConfig = {
    url,
    token,
    projectId,
    mergeRequestId,
  };

  return new GitLabClient(config);
}