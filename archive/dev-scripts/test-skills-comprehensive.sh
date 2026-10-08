#!/bin/bash
# Comprehensive Skill System Test

echo "🧪 Newma Skill System - Comprehensive Test"
echo "============================================"
echo ""

# Test 1: Skill Manager Initialization
echo "Test 1: Skill Manager Initialization"
echo "-------------------------------------"
npx ts-node test-skill-debug.ts 2>&1 | tail -20
echo ""

# Test 2: Check Skill Registry
echo "Test 2: Skill Registry Status"
echo "------------------------------"
if [ -f .kode/skills/registry.json ]; then
  echo "✅ Registry file exists"
  skill_count=$(cat .kode/skills/registry.json | grep -c '"name":')
  echo "   Registered skills: $skill_count"
else
  echo "❌ Registry file not found"
fi
echo ""

# Test 3: Validate Skill Format
echo "Test 3: Skill Format Validation"
echo "--------------------------------"
for skill_dir in .kode/skills/*/; do
  if [ -f "${skill_dir}SKILL.md" ]; then
    skill_name=$(basename "$skill_dir")
    if grep -q "^---" "${skill_dir}SKILL.md"; then
      echo "✅ $skill_name - Has YAML frontmatter"
    else
      echo "❌ $skill_name - Missing YAML frontmatter"
    fi
  fi
done
echo ""

# Test 4: Skill Discovery
echo "Test 4: Skill Discovery Test"
echo "----------------------------"
node -e "
const { SimpleSkillManager } = require('./dist/skills/simple-loader');
const manager = new SimpleSkillManager({
  skillDirectories: ['.kode/skills']
});
manager.discoverSkills().then(skills => {
  console.log('✅ Discovered', skills.length, 'skills');
  skills.forEach(skill => {
    console.log('  -', skill.metadata.name, '(' + skill.metadata.type + ')');
  });
}).catch(err => {
  console.error('❌ Error:', err.message);
});
" 2>&1 || echo "Note: Requires build first"
echo ""

# Test 5: URL Detection
echo "Test 5: URL Type Detection"
echo "---------------------------"
npx ts-node test-url-detection.ts 2>&1 | grep -E "(✅|❌|Results)"
echo ""

echo "============================================"
echo "✅ Test Suite Complete"
echo ""
