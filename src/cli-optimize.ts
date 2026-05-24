#!/usr/bin/env node
/**
 * Kode Self-Optimization CLI
 * Analyzes performance and provides optimization suggestions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SelfOptimizer } from './optimizer/optimizer';

const program = new Command();

// Create analyze command
program
  .name('kode-analyze')
  .description('Analyze Kode performance and get optimization suggestions')
  .version('3.1.0')
  .option('--export', 'Export analysis data to JSON')
  .action(async (options) => {
    console.log(chalk.cyan('\n🔍 Kode Self-Optimization Analysis\n'));

    const optimizer = new SelfOptimizer();

    // Load execution history
    // In a real implementation, this would load from disk
    console.log(chalk.gray('Loading execution history...'));

    // For demo, create sample data
    console.log(chalk.gray('\nAnalyzing performance patterns...\n'));

    // Perform analysis
    const report = optimizer.analyzeAndOptimize();

    // Display results
    displayReport(report);

    // Export if requested
    if (options.export) {
      const jsonData = optimizer.exportLearningData();
      console.log(chalk.cyan('\n📊 Export Data:'));
      console.log(jsonData);
    }
  });

// Create optimize command
program
  .name('kode-optimize')
  .description('Apply automatic optimizations based on analysis')
  .version('3.1.0')
  .option('--dry-run', 'Show what would be optimized without applying')
  .action(async (options) => {
    console.log(chalk.cyan('\n⚡ Kode Self-Optimization\n'));

    const optimizer = new SelfOptimizer();

    if (options.dryRun) {
      console.log(chalk.yellow('DRY RUN MODE - No changes will be applied\n'));

      const report = optimizer.analyzeAndOptimize();
      console.log(chalk.cyan('Optimization Suggestions:'));
      report.suggestions.forEach((s, i) => {
        console.log(`\n${i + 1}. [${s.priority.toUpperCase()}] ${s.description}`);
        console.log(chalk.gray(`   Action: ${s.action}`));
        console.log(chalk.gray(`   Expected: ${s.expectedImprovement}`));
      });
    } else {
      console.log(chalk.yellow('Applying automatic optimizations...\n'));

      const result = optimizer.applyOptimizations();

      console.log(chalk.green(`✅ Applied ${result.appliedSuggestions.length} optimizations`));
      if (result.skippedSuggestions.length > 0) {
        console.log(chalk.yellow(`⚠️  Skipped ${result.skippedSuggestions.length} suggestions (manual intervention required)`));
      }

      for (const skipped of result.skippedSuggestions) {
        console.log(chalk.gray(`   - ${skipped.suggestion.description}: ${skipped.reason}`));
      }
    }

    console.log();
  });

function displayReport(report: any): void {
  // Health score
  const health = report.overallHealth;
  const healthColor = health.level === 'excellent' ? chalk.green :
                      health.level === 'good' ? chalk.blue :
                      health.level === 'fair' ? chalk.yellow : chalk.red;

  console.log(healthColor(`\n📊 Overall Health: ${health.level.toUpperCase()} (${health.score}/100)`));

  if (health.issues.length > 0) {
    console.log(chalk.yellow('\n⚠️  Issues Detected:'));
    health.issues.forEach((issue: string) => {
      console.log(chalk.gray(`   - ${issue}`));
    });
  }

  // Metrics
  console.log(chalk.cyan('\n📈 Performance Metrics:'));
  console.log(`   Total Tasks: ${report.metrics.totalTasks}`);
  console.log(`   Success Rate: ${(report.metrics.successRate * 100).toFixed(1)}%`);
  console.log(`   Average Time: ${report.metrics.averageExecutionTime.toFixed(0)}ms`);
  console.log(`   Failed Tasks: ${report.metrics.failedTasks}`);

  // Agent performance
  if (report.metrics.agentPerformance.size > 0) {
    console.log(chalk.cyan('\n🤖 Agent Performance:'));
    for (const [id, agent] of report.metrics.agentPerformance) {
      const successRate = (agent.successRate * 100).toFixed(1);
      const avgTime = agent.averageTime.toFixed(0);
      console.log(`   ${agent.agentName}:`);
      console.log(chalk.gray(`     Success: ${successRate}%, Time: ${avgTime}ms`));
    }
  }

  // Top patterns
  if (report.patterns.length > 0) {
    console.log(chalk.cyan('\n✨ Successful Patterns:'));
    report.patterns.slice(0, 3).forEach((pattern: any, i: number) => {
      console.log(chalk.gray(`   ${i + 1}. ${pattern.description}`));
      console.log(chalk.gray(`      Confidence: ${(pattern.confidence * 100).toFixed(0)}%`));
    });
  }

  // Suggestions
  if (report.suggestions.length > 0) {
    console.log(chalk.cyan('\n💡 Optimization Suggestions:'));
    report.suggestions.slice(0, 5).forEach((suggestion: any, i: number) => {
      const priorityColor = suggestion.priority === 'high' ? chalk.red :
                          suggestion.priority === 'medium' ? chalk.yellow : chalk.gray;
      console.log(`\n   ${i + 1}. ${priorityColor(`[${suggestion.priority.toUpperCase()}]`)} ${suggestion.description}`);
      console.log(chalk.gray(`      Action: ${suggestion.action}`));
      console.log(chalk.gray(`      Expected: ${suggestion.expectedImprovement}`));
    });
  }

  console.log();
}

// Parse and execute
program.parse(process.argv);
