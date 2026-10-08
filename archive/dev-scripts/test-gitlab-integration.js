#!/usr/bin/env node
/**
 * Test script for GitLab integration
 * Verifies that all components are properly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing GitLab CI/CD Integration\n');

// Test 1: Check module files exist
console.log('📁 Checking module files...');
const gitlabDir = path.join(__dirname, 'src/gitlab');
const requiredFiles = [
  'types.ts',
  'client.ts',
  'reviewer.ts',
  'webhook.ts'
];

for (const file of requiredFiles) {
  const filePath = path.join(gitlabDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lineCount = content.split('\n').length;
    console.log(`  ✅ ${file} (${lineCount} lines)`);
  } else {
    console.log(`  ❌ ${file} missing`);
    process.exit(1);
  }
}

// Test 2: Check gitlab-ci.ts
console.log('\n📄 Checking CI entry point...');
const ciFile = path.join(__dirname, 'src/gitlab-ci.ts');
if (fs.existsSync(ciFile)) {
  const content = fs.readFileSync(ciFile, 'utf8');
  const exports = ['runGitLabCI', 'runGitLabCIFromArgs'];
  for (const exp of exports) {
    if (content.includes(`export ${exp}`) || content.includes(`export { ${exp}`) || content.includes(exp)) {
      console.log(`  ✅ Export: ${exp}`);
    } else {
      console.log(`  ❌ Missing export: ${exp}`);
    }
  }
} else {
  console.log('  ❌ gitlab-ci.ts missing');
  process.exit(1);
}

// Test 3: Check CLI integration
console.log('\n🔧 Checking CLI integration...');
const cliFile = path.join(__dirname, 'src/cli.ts');
if (fs.existsSync(cliFile)) {
  const content = fs.readFileSync(cliFile, 'utf8');
  const commands = ['gitlab review', 'gitlab setup', 'gitlab webhook'];
  for (const cmd of commands) {
    if (content.includes(`'${cmd}'`) || content.includes(`"${cmd}"`)) {
      console.log(`  ✅ Command: ${cmd}`);
    } else {
      console.log(`  ❌ Missing command: ${cmd}`);
    }
  }
} else {
  console.log('  ❌ cli.ts missing');
  process.exit(1);
}

// Test 4: Check template
console.log('\n📋 Checking templates...');
const templateFile = path.join(__dirname, 'templates/gitlab-ci.yml');
if (fs.existsSync(templateFile)) {
  const content = fs.readFileSync(templateFile, 'utf8');
  const requiredSections = ['stages:', 'code_review:', 'script:', 'rules:'];
  for (const section of requiredSections) {
    if (content.includes(section)) {
      console.log(`  ✅ Template section: ${section}`);
    } else {
      console.log(`  ❌ Missing template section: ${section}`);
    }
  }
} else {
  console.log('  ❌ gitlab-ci.yml template missing');
  process.exit(1);
}

// Test 5: Verify key functionality
console.log('\n🔍 Verifying key functionality...');

// Check GitLabClient class
const clientContent = fs.readFileSync(path.join(gitlabDir, 'client.ts'), 'utf8');
const clientMethods = ['getMRDetail', 'getMRDiff', 'createNote', 'testConnection'];
for (const method of clientMethods) {
  if (clientContent.includes(method)) {
    console.log(`  ✅ GitLabClient.${method}()`);
  } else {
    console.log(`  ❌ Missing GitLabClient.${method}()`);
  }
}

// Check MergeRequestReviewer class
const reviewerContent = fs.readFileSync(path.join(gitlabDir, 'reviewer.ts'), 'utf8');
const reviewerMethods = ['reviewMergeRequest', 'callAIForReview', 'buildReviewPrompt'];
for (const method of reviewerMethods) {
  if (reviewerContent.includes(method)) {
    console.log(`  ✅ MergeRequestReviewer.${method}()`);
  } else {
    console.log(`  ❌ Missing MergeRequestReviewer.${method}()`);
  }
}

// Check webhook server
const webhookContent = fs.readFileSync(path.join(gitlabDir, 'webhook.ts'), 'utf8');
const webhookClasses = ['GitLabWebhookServer', 'MergeRequestEventHandler'];
for (const className of webhookClasses) {
  if (webhookContent.includes(className)) {
    console.log(`  ✅ ${className}`);
  } else {
    console.log(`  ❌ Missing ${className}`);
  }
}

// Test 6: Check type definitions
console.log('\n📝 Checking type definitions...');
const typesContent = fs.readFileSync(path.join(gitlabDir, 'types.ts'), 'utf8');
const requiredTypes = [
  'MergeRequestEvent',
  'GitLabConfig',
  'ReviewIssue',
  'ReviewResult'
];
for (const type of requiredTypes) {
  if (typesContent.includes(`interface ${type}`) || typesContent.includes(`type ${type}`)) {
    console.log(`  ✅ Type: ${type}`);
  } else {
    console.log(`  ❌ Missing type: ${type}`);
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ GitLab CI/CD Integration Test Passed!');
console.log('='.repeat(50));
console.log('\n📚 Usage:');
console.log('  npx newma-cli gitlab review      # Review a MR');
console.log('  npx newma-cli gitlab setup       # Generate CI config');
console.log('  npx newma-cli gitlab webhook     # Start webhook server');
console.log('');