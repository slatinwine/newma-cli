#!/usr/bin/env ts-node
/**
 * 测试问题追踪系统
 */

import { IssueTracker, IssueType, IssueSeverity, IssueStatus } from './src/memory/issue-tracker';
import { ExplorationResult } from './src/agents/autonomous-explorer';
import * as path from 'path';

async function testIssueTracker() {
  console.log('🧪 Testing Issue Tracker System\n');

  const issueTracker = new IssueTracker({
    issuesDir: path.join(process.cwd(), '.kode', 'issues'),
    retentionDays: 30,
  });

  // 模拟一个探索结果
  const mockResult: ExplorationResult = {
    taskId: 'test-task-123',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    duration: 5000,
    plan: {
      taskId: 'plan-123',
      timestamp: new Date().toISOString(),
      domains: ['system_maintenance', 'code_analysis'],
      actions: [],
      priorities: {
        high: ['Test high priority action'],
        medium: ['Test medium priority action'],
        low: ['Test low priority action'],
      },
    },
    actions: [
      {
        id: 'action-1',
        domain: 'system_maintenance',
        type: 'config_review',
        description: 'Review system configuration',
        priority: 'high',
        status: 'failed',
        error: 'Unknown system maintenance action: config_review',
      },
      {
        id: 'action-2',
        domain: 'code_analysis',
        type: 'static_analysis',
        description: 'Run static analysis',
        priority: 'medium',
        status: 'completed',
        result: {
          duration: 0,
          message: 'Static analysis placeholder',
        },
      },
    ],
    summary: {
      total: 2,
      completed: 1,
      failed: 1,
      byDomain: {
        system_maintenance: 1,
        code_analysis: 1,
        knowledge_exploration: 0,
        workspace_optimization: 0,
      },
    },
    insights: [
      '50% of exploration actions failed, indicating configuration issues',
      'Completed action returned placeholder results with zero duration',
    ],
    recommendations: [
      'Implement missing action types in the executor',
      'Replace placeholder logic with actual functionality',
    ],
  };

  console.log('📊 Extracting issues from mock exploration result...\n');

  // 提取问题
  const issues = await issueTracker.extractIssues(mockResult);

  console.log(`✓ Extracted ${issues.length} issues:\n`);
  issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.id}]`);
    console.log(`     Type: ${issue.type}`);
    console.log(`     Severity: ${issue.severity}`);
    console.log(`     Title: ${issue.title}\n`);
  });

  // 记录问题
  console.log('💾 Recording issues to filesystem...\n');
  await issueTracker.recordIssues(issues);

  // 生成报告
  console.log('📋 Generating issue report...\n');
  const report = await issueTracker.generateIssueReport();
  console.log(report);

  // 获取待处理问题
  console.log('🔍 Fetching open issues...\n');
  const openIssues = await issueTracker.getOpenIssues();
  console.log(`✓ Found ${openIssues.length} open issue(s)\n`);

  // 测试状态更新
  if (openIssues.length > 0) {
    const firstIssue = openIssues[0];
    console.log(`🔄 Testing status update for issue ${firstIssue.id}...\n`);

    await issueTracker.updateIssueStatus(
      firstIssue.id,
      IssueStatus.IN_PROGRESS,
      'Claude Code is working on fixing this issue'
    );

    console.log('✓ Status updated successfully\n');
  }

  console.log('✅ Issue Tracker test completed!\n');
  console.log('📁 Issue files saved to: .kode/issues/');
  console.log('📄 Run "cat .kode/issues/*.json" to view individual issues\n');
}

testIssueTracker().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
