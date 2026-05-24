// src/gitlab-ci.ts
/**
 * GitLab CI/CD Integration Entry Point
 * Main entry point for running in GitLab CI pipelines
 */

import chalk from 'chalk';
import { getDefaultConfig } from './config';
import { GitLabClient, createClientFromEnv } from './gitlab/client';
import { MergeRequestReviewer, publishReviewResults } from './gitlab/reviewer';
import { GitLabConfig } from './gitlab/types';

/**
 * GitLab CI main function
 */
export async function runGitLabCI(): Promise<number> {
  console.log(chalk.cyan('🚀 Newma GitLab CI/CD Integration\n'));

  try {
    // Load configuration from environment
    const config = loadConfigFromEnv();

    // Test GitLab connection
    console.log(chalk.gray('🔌 Testing GitLab connection...'));
    const client = createClientFromEnv();

    if (!client) {
      console.error(chalk.red('❌ Failed to create GitLab client'));
      return 1;
    }

    const connected = await client.testConnection();
    if (!connected) {
      console.error(chalk.red('❌ GitLab connection test failed'));
      return 1;
    }

    // Get MR details from environment
    const projectId = parseInt(process.env.CI_PROJECT_ID || '0');
    const mrIid = parseInt(process.env.CI_MERGE_REQUEST_IID || '0');

    if (!projectId || !mrIid) {
      console.error(chalk.red('❌ Missing CI_PROJECT_ID or CI_MERGE_REQUEST_IID environment variables'));
      console.error(chalk.yellow('This script must be run in a GitLab CI merge request pipeline'));
      return 1;
    }

    console.log(chalk.gray(`📋 Processing MR !${mrIid} in project ${projectId}...`));

    // Get AI configuration
    const aiConfig = getDefaultConfig();

    // Create reviewer
    const reviewer = new MergeRequestReviewer(config, aiConfig);

    // Perform review
    const result = await reviewer.reviewMergeRequest(projectId, mrIid);

    // Publish results
    if (!config.dryRun) {
      console.log(chalk.gray('📤 Publishing review results to GitLab...'));
      await publishReviewResults(client, projectId, mrIid, result);
    } else {
      console.log(chalk.yellow('⚠️  Dry run mode - skipping GitLab publication'));
    }

    // Auto-fix if enabled and there are error-level issues
    if (config.autoFix && result.summary.errors > 0) {
      console.log(chalk.yellow('🔧 Auto-fix enabled - attempting to fix error-level issues...'));
      const fixed = await autoFixIssues(client, projectId, mrIid, result);
      console.log(chalk.green(`✅ Auto-fixed ${fixed} issue(s)`));
    }

    // Return exit code based on results
    if (result.summary.errors > 0) {
      console.log(chalk.red(`\n❌ Review failed with ${result.summary.errors} error(s)`));
      return 1;
    } else if (result.summary.warnings > 0) {
      console.log(chalk.yellow(`\n⚠️  Review passed with ${result.summary.warnings} warning(s)`));
      return 0;
    } else {
      console.log(chalk.green(`\n✅ Review passed with no errors or warnings`));
      return 0;
    }
  } catch (error: any) {
    console.error(chalk.red(`❌ GitLab CI failed: ${error.message}`));
    console.error(chalk.gray(error.stack));
    return 2;
  }
}

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): GitLabConfig {
  const url = process.env.GITLAB_URL || process.env.CI_SERVER_URL;
  const token = process.env.GITLAB_TOKEN || process.env.CI_JOB_TOKEN;
  const autoFix = process.env.NEWSMA_AUTO_FIX === 'true';
  const dryRun = process.env.NEWSMA_DRY_RUN === 'true';
  const maxFiles = parseInt(process.env.NEWSMA_MAX_FILES || '20');
  const maxLines = parseInt(process.env.NEWSMA_MAX_LINES || '500');

  if (!url || !token) {
    throw new Error('Missing required environment variables: GITLAB_URL and GITLAB_TOKEN');
  }

  return {
    url,
    token,
    projectId: parseInt(process.env.CI_PROJECT_ID || '0'),
    mergeRequestId: parseInt(process.env.CI_MERGE_REQUEST_IID || '0'),
    maxFiles,
    maxLinesPerFile: maxLines,
    autoFix,
    dryRun,
  };
}

/**
 * Auto-fix issues (placeholder for future implementation)
 */
async function autoFixIssues(
  client: GitLabClient,
  projectId: number,
  mrIid: number,
  result: any
): Promise<number> {
  // TODO: Implement auto-fix logic
  // This could involve:
  // 1. Creating commits to fix issues
  // 2. Pushing changes to the MR
  // 3. Updating the MR description

  console.log(chalk.yellow('⚠️  Auto-fix not yet implemented'));
  return 0;
}

/**
 * Run GitLab CI from command line
 */
export async function runGitLabCIFromArgs(args: {
  projectId?: number;
  mrIid?: number;
  gitlabUrl?: string;
  gitlabToken?: string;
  autoFix?: boolean;
  dryRun?: boolean;
}): Promise<number> {
  // Set environment variables from args
  if (args.projectId) process.env.CI_PROJECT_ID = args.projectId.toString();
  if (args.mrIid) process.env.CI_MERGE_REQUEST_IID = args.mrIid.toString();
  if (args.gitlabUrl) process.env.GITLAB_URL = args.gitlabUrl;
  if (args.gitlabToken) process.env.GITLAB_TOKEN = args.gitlabToken;
  if (args.autoFix) process.env.NEWSMA_AUTO_FIX = 'true';
  if (args.dryRun) process.env.NEWSMA_DRY_RUN = 'true';

  return runGitLabCI();
}

// Export for use in CLI
export { runGitLabCI as default };