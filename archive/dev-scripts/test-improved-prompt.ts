import { chatAI } from './src/ai';
import { getDefaultConfig } from './src/config';

async function testImprovedPrompt() {
  console.log('Testing improved /init prompt...\n');

  // Simulate a small project info
  const mockProjectInfo = {
    'src/cli.ts': `import { Command } from 'commander';
import { scanDirectory } from './scanner';
import { callAI } from './ai';

const program = new Command();
program.option('-i, --interactive', 'Start interactive mode');
program.parse(process.argv);`,
    'package.json': `{
  "name": "newma-cli",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}`,
    'README.md': `# Kode CLI

AI-powered development assistant.

## Usage
\`\`\`bash
npx newma-cli -i
\`\`\`
`
  };

  // Create simplified file summary
  const files = Object.keys(mockProjectInfo) as Array<keyof typeof mockProjectInfo>;
  const fileSummary = files.map(file => {
    const content = mockProjectInfo[file];
    const preview = content.split('\n').slice(0, 5).join('\n').substring(0, 200);
    return `- **${file}**:\n\`\`\`\n${preview}\n\`\`\``;
  }).join('\n\n');

  const prompt = `Analyze the following project files and generate a comprehensive markdown overview.

## Files to Analyze

${fileSummary}

---

Generate a markdown document with the following sections:

## Project Overview

[Brief description - 2-3 sentences]

## Tech Stack

[Programming languages, frameworks, dependencies]

## Architecture

[High-level structure and main components]

## Key Files and Their Purposes

[Important files and what they do]

## Development Guide

[How to run, test, and build]

## Important Notes

[Conventions, patterns, considerations]

---

REQUIREMENTS:
- Output ONLY the markdown document above
- Start immediately with "## Project Overview"
- Do NOT include explanations, thinking process, or meta-commentary
- Use proper markdown formatting
- Be concise and clear
- Focus on essential information`;

  try {
    const config = getDefaultConfig();
    const summary = await chatAI(config, prompt);

    console.log('========== Generated Summary ==========\n');
    console.log(summary);
    console.log('\n========== End of Summary ==========\n');

    // Check if it has proper markdown structure
    const hasHeaders = summary.includes('##');
    const hasLists = summary.includes('-');
    const isReadable = summary.length > 100 && summary.length < 10000;

    console.log('\nQuality Check:');
    console.log('- Has markdown headers:', hasHeaders ? '✅' : '❌');
    console.log('- Has lists:', hasLists ? '✅' : '❌');
    console.log('- Reasonable length:', isReadable ? '✅' : '❌');
    console.log('- Line count:', summary.split('\n').length);

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testImprovedPrompt();
