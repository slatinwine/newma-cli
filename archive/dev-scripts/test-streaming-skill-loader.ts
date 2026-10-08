#!/usr/bin/env bun
/**
 * Test script for streaming skill loader
 *
 * Demonstrates progressive loading of skill content
 */

import { createStreamingSkillLoader } from './src/plugins/streaming-skill-loader';
import chalk from 'chalk';

async function testStreamingSkillLoader() {
  console.log(chalk.cyan('\n🧪 Testing Streaming Skill Loader\n'));

  const streamingLoader = createStreamingSkillLoader({
    enableStreaming: true,
    includeMetadata: true,
    verbose: true,
    chunkDelay: 500, // 500ms delay between chunks for demo
  });

  const skillPath = './examples/skills/doc-coauthoring';

  console.log(chalk.yellow('Loading skill with streaming...\n'));

  try {
    let coreReceived = false;
    let sectionsReceived = 0;
    const startTime = Date.now();

    // Stream the skill
    for await (const chunk of streamingLoader.loadSkillStream(skillPath)) {
      const elapsed = Date.now() - startTime;

      switch (chunk.type) {
        case 'core':
          console.log(chalk.green(`\n✅ [${elapsed}ms] Core Content Received`));
          console.log(chalk.gray('─'.repeat(60)));
          console.log(chalk.gray(chunk.content.slice(0, 200) + '...'));
          console.log(chalk.gray('─'.repeat(60)));
          coreReceived = true;
          break;

        case 'metadata':
          const { totalSections, loadedSections } = chunk.metadata;
          console.log(chalk.cyan(`\n📊 Progress: ${loadedSections}/${totalSections} sections loaded`));
          break;

        case 'section':
          sectionsReceived++;
          console.log(chalk.blue(`\n📄 [${elapsed}ms] Section ${sectionsReceived}: ${chunk.title}`));
          console.log(chalk.gray(`   ID: ${chunk.sectionId}`));
          console.log(chalk.gray(`   Tokens: ~${Math.ceil(chunk.content.length / 4)}`));
          console.log(chalk.gray(chunk.content.slice(0, 100) + '...'));
          break;

        case 'complete':
          console.log(chalk.green(`\n✅ [${elapsed}ms] Loading Complete!`));
          console.log(chalk.gray(`Total time: ${elapsed}ms`));
          console.log(chalk.gray(`Sections loaded: ${sectionsReceived}`));
          break;

        case 'error':
          console.error(chalk.red(`\n❌ Error: ${chunk.error.message}`));
          break;
      }
    }

    console.log(chalk.green('\n✨ Streaming test completed successfully!'));

    // Compare with non-streaming load
    console.log(chalk.cyan('\n\n🔄 Comparing with non-streaming load...\n'));

    const syncStartTime = Date.now();
    const syncLoader = await import('./src/plugins/skill-loader').then(m => new m.SkillLoader());
    const syncSkill = syncLoader.loadSkillSync(skillPath);
    const syncTime = Date.now() - syncStartTime;

    console.log(chalk.yellow(`Non-streaming load time: ${syncTime}ms`));
    console.log(chalk.green('Streaming: Core content available immediately'));
    console.log(chalk.green('Non-streaming: Must wait for full load\n'));

  } catch (error: any) {
    console.error(chalk.red(`\n❌ Test failed: ${error.message}`));
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testStreamingSkillLoader();
