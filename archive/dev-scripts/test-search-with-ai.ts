/**
 * Example: Using search results with AI
 * Demonstrates how to search the web, fetch content, and send it to AI
 */

import { searchAndFetchTool } from './src/tools/builtin/search-and-fetch';
import { ExecutionTracker } from './src/history';
import { Config } from './src/config';
import { Permission } from './src/tools/types';
import { formatSearchMetadataForAI } from './src/tools/builtin/search-and-fetch';

/**
 * Example 1: Search and format for AI
 */
async function example1_SearchAndFormat() {
  console.log('📚 Example 1: Search and Format for AI\n');

  const tracker = new ExecutionTracker();
  const config: Config = {
    apiKey: 'test-key',
    model: 'gpt-4',
    baseUrl: 'https://api.openai.com',
  };

  const context = {
    root: process.cwd(),
    history: tracker,
    permissions: new Set([Permission.NETWORK_ACCESS]),
    config,
  };

  // Step 1: Search and fetch
  const searchResult = await searchAndFetchTool.handler(
    {
      query: 'TypeScript vs JavaScript differences',
      max_results: 3,
      content_length: 5000,
    },
    context
  );

  if (!searchResult.success) {
    console.log(`❌ Search failed: ${searchResult.error}`);
    return;
  }

  // Step 2: Format for AI
  if (!searchResult.metadata) {
    console.log('❌ No metadata in search result');
    return;
  }

  const formattedContent = formatSearchMetadataForAI(searchResult.metadata);

  console.log('✅ Content ready for AI!\n');
  console.log('='.repeat(60));
  console.log(formattedContent);
  console.log('='.repeat(60));

  // Step 3: Prepare AI prompt (example)
  const aiPrompt = `
You are a technical writer. Based on the following search results, write a comprehensive comparison of TypeScript and JavaScript.

${formattedContent}

Please provide:
1. Key differences between TypeScript and JavaScript
2. Advantages of TypeScript
3. When to use TypeScript vs JavaScript
  `;

  console.log('\n🤖 AI Prompt Preview:');
  console.log('-'.repeat(60));
  console.log(aiPrompt.substring(0, 500) + '...');
  console.log('-'.repeat(60));

  return { searchResult, formattedContent, aiPrompt };
}

/**
 * Example 2: Multiple searches with AI
 */
async function example2_MultipleSearches() {
  console.log('\n\n📊 Example 2: Multiple Searches for AI Analysis\n');

  const queries = [
    'TypeScript benefits 2025',
    'TypeScript best practices',
    'TypeScript performance',
  ];

  const results = [];

  for (const query of queries) {
    console.log(`🔍 Searching: "${query}"`);

    const tracker = new ExecutionTracker();
    const config: Config = {
      apiKey: 'test-key',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com',
    };

    const context = {
      root: process.cwd(),
      history: tracker,
      permissions: new Set([Permission.NETWORK_ACCESS]),
      config,
    };

    const result = await searchAndFetchTool.handler(
      {
        query,
        max_results: 2,
        content_length: 3000,
      },
      context
    );

    if (result.success) {
      if (!result.metadata) continue;

      console.log(`✅ Found ${result.metadata.successful_count} pages`);
      results.push({
        query,
        metadata: result.metadata,
        formatted: formatSearchMetadataForAI(result.metadata),
      });
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  }

  console.log('\n📋 Summary:');
  console.log(`   Total queries: ${queries.length}`);
  console.log(`   Successful: ${results.length}`);
  const totalChars = results.reduce((sum, r) => {
    const len = r.metadata?.total_content_length as number | undefined;
    return sum + (len || 0);
  }, 0);
  console.log(`   Total content: ${totalChars} chars`);

  // Combine all results for AI
  let combinedContent = '# Comprehensive Research: TypeScript in 2025\n\n';
  combinedContent += `This document combines research from ${results.length} search queries.\n\n`;
  combinedContent += '---\n\n';

  results.forEach((r, i) => {
    combinedContent += `## Research Query ${i + 1}: "${r.query}"\n\n`;
    combinedContent += r.formatted;
    combinedContent += '\n';
  });

  console.log('\n🤖 Combined Content for AI:');
  console.log('='.repeat(60));
  console.log(combinedContent.substring(0, 1000) + '...');
  console.log('='.repeat(60));

  return results;
}

/**
 * Example 3: Research assistant workflow
 */
async function example3_ResearchAssistant() {
  console.log('\n\n🎓 Example 3: Research Assistant Workflow\n');

  const topic = 'TypeScript type system advantages';
  console.log(`📖 Researching: "${topic}"\n`);

  // Step 1: Search for information
  const tracker = new ExecutionTracker();
  const config: Config = {
    apiKey: 'test-key',
    model: 'gpt-4',
    baseUrl: 'https://api.openai.com',
  };

  const context = {
    root: process.cwd(),
    history: tracker,
    permissions: new Set([Permission.NETWORK_ACCESS]),
    config,
  };

  const searchResult = await searchAndFetchTool.handler(
    {
      query: topic,
      max_results: 5,
      content_length: 8000,
    },
    context
  );

  if (!searchResult.success) {
    console.log(`❌ Research failed: ${searchResult.error}`);
    return;
  }

  if (!searchResult.metadata) {
    console.log('❌ No metadata in research result');
    return;
  }

  console.log(`✅ Gathered information from ${searchResult.metadata.successful_count} sources\n`);

  // Step 2: Format research data
  const researchData = formatSearchMetadataForAI(searchResult.metadata);

  // Step 3: Create structured report prompt
  const reportPrompt = `
# Research Report: ${topic}

## Instructions
You are a research assistant. Based on the gathered information, create a comprehensive report.

## Research Data
${researchData}

## Report Structure
Please create a report with the following sections:

1. **Executive Summary** (150-200 words)
2. **Key Findings** (bullet points)
3. **Detailed Analysis** (3-4 paragraphs)
4. **Practical Implications** (how this applies to real-world projects)
5. **Recommendations** (actionable advice)
6. **Sources Cited** (list of URLs)

## Output Format
- Use Markdown formatting
- Be clear and concise
- Focus on actionable insights
- Include specific examples where applicable
  `;

  console.log('🤖 Research Report Prompt Generated:');
  console.log('='.repeat(60));
  console.log(reportPrompt.substring(0, 800) + '...');
  console.log('='.repeat(60));

  console.log('\n💡 Next Steps:');
  console.log('   1. Send this prompt to an AI (e.g., GPT-4)');
  console.log('   2. AI will analyze the research data');
  console.log('   3. Receive a comprehensive report');
  console.log('   4. Review and refine as needed');

  return { searchResult, reportPrompt };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Search + AI Integration Examples\n');
  console.log('=' .repeat(60));
  console.log();

  try {
    await example1_SearchAndFormat();
    await example2_MultipleSearches();
    await example3_ResearchAssistant();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All examples completed successfully!');
    console.log('\n💡 Key Takeaways:');
    console.log('   1. Search and fetch web content');
    console.log('   2. Format content for AI consumption');
    console.log('   3. Create structured prompts for AI');
    console.log('   4. Combine multiple searches for comprehensive research');
    console.log('\n🔗 Integration with Kode AI:');
    console.log('   Use these tools within Kode\'s AI system for');
    console.log('   automated research and analysis!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run examples
main().catch(console.error);
