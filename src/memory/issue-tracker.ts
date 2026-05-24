/**
 * Issue Tracker - 自主探索问题追踪系统
 *
 * 记录探索中发现的问题，供 Claude Code 修复
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExplorationResult } from '../agents/autonomous-explorer';

/**
 * 问题类型
 */
export enum IssueType {
  /** 动作类型未实现 */
  UNIMPLEMENTED_ACTION = 'unimplemented_action',
  /** 配置错误 */
  CONFIGURATION_ERROR = 'configuration_error',
  /** 依赖问题 */
  DEPENDENCY_ISSUE = 'dependency_issue',
  /** 代码质量问题 */
  CODE_QUALITY = 'code_quality',
  /** 架构问题 */
  ARCHITECTURE_ISSUE = 'architecture_issue',
  /** 性能问题 */
  PERFORMANCE = 'performance',
  /** 其他问题 */
  OTHER = 'other',
}

/**
 * 问题严重程度
 */
export enum IssueSeverity {
  /** 低 - 可以稍后处理 */
  LOW = 'low',
  /** 中 - 影响部分功能 */
  MEDIUM = 'medium',
  /** 高 - 严重影响系统 */
  HIGH = 'high',
  /** 紧急 - 需要立即处理 */
  CRITICAL = 'critical',
}

/**
 * 问题状态
 */
export enum IssueStatus {
  /** 待处理 */
  OPEN = 'open',
  /** 正在修复 */
  IN_PROGRESS = 'in_progress',
  /** 已修复 */
  FIXED = 'fixed',
  /** 已验证 */
  VERIFIED = 'verified',
  /** 暂不处理 */
  WONT_FIX = 'wont_fix',
  /** 无法重现 */
  CANNOT_REPRODUCE = 'cannot_reproduce',
}

/**
 * 问题记录
 */
export interface Issue {
  /** 问题ID */
  id: string;
  /** 任务ID */
  taskId: string;
  /** 类型 */
  type: IssueType;
  /** 严重程度 */
  severity: IssueSeverity;
  /** 状态 */
  status: IssueStatus;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 相关动作ID */
  actionId?: string;
  /** 相关领域 */
  domain?: string;
  /** 错误信息 */
  error?: string;
  /** 建议的修复方案 */
  suggestions: string[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 修复历史 */
  fixHistory?: FixAttempt[];
}

/**
 * 修复尝试
 */
export interface FixAttempt {
  /** 尝试时间 */
  timestamp: string;
  /** 修复者 */
  fixer: string;
  /** 修复描述 */
  description: string;
  /** 是否成功 */
  success: boolean;
}

/**
 * 问题追踪器配置
 */
export interface IssueTrackerConfig {
  /** 问题目录 */
  issuesDir: string;
  /** 问题保留天数 */
  retentionDays?: number;
}

/**
 * 问题追踪器
 */
export class IssueTracker {
  private config: Required<IssueTrackerConfig>;

  constructor(config: IssueTrackerConfig) {
    this.config = {
      issuesDir: config.issuesDir,
      retentionDays: config.retentionDays || 30,
    };

    this.ensureIssuesDirectory();
  }

  /**
   * 从探索结果中提取问题
   */
  async extractIssues(result: ExplorationResult): Promise<Issue[]> {
    const issues: Issue[] = [];
    const timestamp = new Date().toISOString();

    // 1. 检查失败的动作
    for (const action of result.actions) {
      if (action.status === 'failed') {
        // 确定问题类型
        let type = IssueType.OTHER;
        if (action.error?.includes('Unknown')) {
          type = IssueType.UNIMPLEMENTED_ACTION;
        } else if (action.error?.includes('config')) {
          type = IssueType.CONFIGURATION_ERROR;
        }

        // 确定严重程度
        let severity = IssueSeverity.MEDIUM;
        if (action.priority === 'high') {
          severity = IssueSeverity.HIGH;
        } else if (action.priority === 'low') {
          severity = IssueSeverity.LOW;
        }

        issues.push({
          id: this.generateIssueId(),
          taskId: result.taskId,
          type,
          severity,
          status: IssueStatus.OPEN,
          title: `Failed action: ${action.description.substring(0, 50)}`,
          description: action.description,
          actionId: action.id,
          domain: action.domain,
          error: action.error,
          suggestions: [
            `Implement the action type: ${action.type}`,
            `Add error handling for: ${action.domain}`,
            `Review executor logic for ${action.domain}`,
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    // 2. 检查占位符结果（duration=0）
    for (const action of result.actions) {
      if (action.status === 'completed' && action.result?.duration === 0) {
        issues.push({
          id: this.generateIssueId(),
          taskId: result.taskId,
          type: IssueType.UNIMPLEMENTED_ACTION,
          severity: IssueSeverity.MEDIUM,
          status: IssueStatus.OPEN,
          title: `Placeholder implementation: ${action.type}`,
          description: `Action ${action.type} returned placeholder data instead of real results`,
          actionId: action.id,
          domain: action.domain,
          suggestions: [
            `Replace placeholder logic with actual implementation`,
            `Add real data processing for ${action.type}`,
            `Implement verification for ${action.domain}`,
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    // 3. 从 insights 中提取问题
    if (result.insights && result.insights.length > 0) {
      // 查找包含 "fail"、"error"、"issue" 等关键词的洞察
      const problematicInsights = result.insights.filter(insight =>
        insight.toLowerCase().includes('fail') ||
        insight.toLowerCase().includes('error') ||
        insight.toLowerCase().includes('issue') ||
        insight.toLowerCase().includes('placeholder')
      );

      for (const insight of problematicInsights) {
        issues.push({
          id: this.generateIssueId(),
          taskId: result.taskId,
          type: IssueType.OTHER,
          severity: IssueSeverity.MEDIUM,
          status: IssueStatus.OPEN,
          title: 'Exploration insight issue',
          description: insight,
          suggestions: result.recommendations || [],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    return issues;
  }

  /**
   * 记录问题到文件系统
   */
  async recordIssues(issues: Issue[]): Promise<void> {
    if (issues.length === 0) {
      console.log('✓ No new issues to record');
      return;
    }

    let recordedCount = 0;

    for (const issue of issues) {
      try {
        const issuePath = this.getIssuePath(issue.id);
        fs.writeFileSync(issuePath, JSON.stringify(issue, null, 2), 'utf-8');
        recordedCount++;
      } catch (error: any) {
        console.error(`Failed to record issue ${issue.id}: ${error.message}`);
      }
    }

    // 更新索引
    await this.updateIndex(issues);

    console.log(`✓ Recorded ${recordedCount} new issues`);
  }

  /**
   * 获取所有待处理问题
   */
  async getOpenIssues(): Promise<Issue[]> {
    const indexPath = this.getIndexIndexPath();

    if (!fs.existsSync(indexPath)) {
      return [];
    }

    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      const issueIds = index.issues || [];

      const issues: Issue[] = [];
      for (const issueId of issueIds) {
        const issuePath = this.getIssuePath(issueId);
        if (fs.existsSync(issuePath)) {
          const issue = JSON.parse(fs.readFileSync(issuePath, 'utf-8')) as Issue;
          if (issue.status === IssueStatus.OPEN || issue.status === IssueStatus.IN_PROGRESS) {
            issues.push(issue);
          }
        }
      }

      // 按严重程度和创建时间排序
      return issues.sort((a, b) => {
        const severityOrder = { [IssueSeverity.CRITICAL]: 0, [IssueSeverity.HIGH]: 1, [IssueSeverity.MEDIUM]: 2, [IssueSeverity.LOW]: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    } catch (error: any) {
      console.error(`Failed to get open issues: ${error.message}`);
      return [];
    }
  }

  /**
   * 生成问题报告摘要
   */
  async generateIssueReport(): Promise<string> {
    const issues = await this.getOpenIssues();

    if (issues.length === 0) {
      return '✓ No open issues - system is healthy!';
    }

    const severityGroups = {
      [IssueSeverity.CRITICAL]: issues.filter(i => i.severity === IssueSeverity.CRITICAL),
      [IssueSeverity.HIGH]: issues.filter(i => i.severity === IssueSeverity.HIGH),
      [IssueSeverity.MEDIUM]: issues.filter(i => i.severity === IssueSeverity.MEDIUM),
      [IssueSeverity.LOW]: issues.filter(i => i.severity === IssueSeverity.LOW),
    };

    const typeGroups = {
      [IssueType.UNIMPLEMENTED_ACTION]: issues.filter(i => i.type === IssueType.UNIMPLEMENTED_ACTION),
      [IssueType.CONFIGURATION_ERROR]: issues.filter(i => i.type === IssueType.CONFIGURATION_ERROR),
      [IssueType.DEPENDENCY_ISSUE]: issues.filter(i => i.type === IssueType.DEPENDENCY_ISSUE),
    };

    let report = '\n';
    report += '='.repeat(60) + '\n';
    report += '📋 OPEN ISSUES REPORT\n';
    report += '='.repeat(60) + '\n\n';

    report += `Total Open Issues: ${issues.length}\n\n`;

    // 按严重程度分组
    report += '📊 By Severity:\n';
    for (const [severity, severityIssues] of Object.entries(severityGroups)) {
      if (severityIssues.length > 0) {
        const icon = this.getSeverityIcon(severity as IssueSeverity);
        report += `  ${icon} ${severity.toUpperCase()}: ${severityIssues.length}\n`;
      }
    }

    // 按类型分组
    report += '\n📂 By Type:\n';
    for (const [type, typeIssues] of Object.entries(typeGroups)) {
      if (typeIssues.length > 0) {
        report += `  • ${type}: ${typeIssues.length}\n`;
      }
    }

    // 详细问题列表
    report += '\n' + '='.repeat(60) + '\n';
    report += '📝 ISSUE DETAILS\n';
    report += '='.repeat(60) + '\n\n';

    for (const issue of issues) {
      report += this.formatIssue(issue);
      report += '\n' + '-'.repeat(60) + '\n\n';
    }

    return report;
  }

  /**
   * 更新问题状态
   */
  async updateIssueStatus(
    issueId: string,
    status: IssueStatus,
    fixDescription?: string
  ): Promise<void> {
    const issuePath = this.getIssuePath(issueId);

    if (!fs.existsSync(issuePath)) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const issue: Issue = JSON.parse(fs.readFileSync(issuePath, 'utf-8'));
    issue.status = status;
    issue.updatedAt = new Date().toISOString();

    if (fixDescription) {
      if (!issue.fixHistory) {
        issue.fixHistory = [];
      }

      issue.fixHistory.push({
        timestamp: new Date().toISOString(),
        fixer: 'claude-code',
        description: fixDescription,
        success: status === IssueStatus.FIXED || status === IssueStatus.VERIFIED,
      });
    }

    fs.writeFileSync(issuePath, JSON.stringify(issue, null, 2), 'utf-8');
  }

  // ========== Private Methods ==========

  /**
   * 生成问题ID
   */
  private generateIssueId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `issue-${timestamp}-${random}`;
  }

  /**
   * 获取问题文件路径
   */
  private getIssuePath(issueId: string): string {
    return path.join(this.config.issuesDir, `${issueId}.json`);
  }

  /**
   * 获取索引文件路径
   */
  private getIndexIndexPath(): string {
    return path.join(this.config.issuesDir, 'issues-index.json');
  }

  /**
   * 确保问题目录存在
   */
  private ensureIssuesDirectory(): void {
    if (!fs.existsSync(this.config.issuesDir)) {
      fs.mkdirSync(this.config.issuesDir, { recursive: true });
    }
  }

  /**
   * 更新索引
   */
  private async updateIndex(newIssues: Issue[]): Promise<void> {
    const indexPath = this.getIndexIndexPath();
    let index: any = { issues: [] };

    // 读取现有索引
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch (error: any) {
        console.warn(`Failed to read issues index: ${error.message}`);
      }
    }

    // 添加新问题ID
    const newIssueIds = newIssues.map(issue => issue.id);
    index.issues = [...new Set([...(index.issues || []), ...newIssueIds])];

    // 保存索引
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * 获取严重程度图标
   */
  private getSeverityIcon(severity: IssueSeverity): string {
    const icons = {
      [IssueSeverity.CRITICAL]: '🔴',
      [IssueSeverity.HIGH]: '🟠',
      [IssueSeverity.MEDIUM]: '🟡',
      [IssueSeverity.LOW]: '🟢',
    };
    return icons[severity] || '⚪';
  }

  /**
   * 格式化问题显示
   */
  private formatIssue(issue: Issue): string {
    let formatted = '';
    formatted += `${this.getSeverityIcon(issue.severity)} [${issue.id}]\n`;
    formatted += `Type: ${issue.type}\n`;
    formatted += `Status: ${issue.status}\n`;
    formatted += `Created: ${new Date(issue.createdAt).toLocaleString()}\n\n`;
    formatted += `Title: ${issue.title}\n\n`;
    formatted += `Description:\n  ${issue.description}\n\n`;

    if (issue.error) {
      formatted += `Error:\n  ${issue.error}\n\n`;
    }

    if (issue.suggestions.length > 0) {
      formatted += `Suggestions:\n`;
      issue.suggestions.forEach((suggestion, i) => {
        formatted += `  ${i + 1}. ${suggestion}\n`;
      });
      formatted += '\n';
    }

    if (issue.fixHistory && issue.fixHistory.length > 0) {
      formatted += `Fix History:\n`;
      issue.fixHistory.forEach((fix) => {
        const statusIcon = fix.success ? '✅' : '❌';
        formatted += `  ${statusIcon} ${new Date(fix.timestamp).toLocaleString()} by ${fix.fixer}\n`;
        formatted += `     ${fix.description}\n`;
      });
      formatted += '\n';
    }

    return formatted;
  }
}
