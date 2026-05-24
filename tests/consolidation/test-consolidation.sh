#!/bin/bash

echo "=========================================="
echo "  Agent Consolidation - Integration Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_command() {
  local name="$1"
  local command="$2"
  local expected="$3"

  echo "Testing: $name"
  result=$(eval "$command" 2>&1)

  if echo "$result" | grep -q "$expected"; then
    echo -e "${GREEN}✓ PASSED${NC}: $name"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}: $name"
    echo "  Expected: $expected"
    echo "  Got: $result"
    ((FAILED++))
  fi
  echo ""
}

echo "1. Testing CLI deprecation warnings"
echo "────────────────────────────────────"

# Test two-phase flag warning
echo -e "\n${YELLOW}Test 1a: --two-phase flag shows deprecation warning${NC}"
node dist/cli.js --two-phase "test" 2>&1 | grep -q "WARNING: --two-phase flag is deprecated" && \
  echo -e "${GREEN}✓ PASSED${NC}: Two-phase deprecation warning shown" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: Two-phase deprecation warning not shown" && ((FAILED++)))

# Test multi-agent flag warning
echo -e "\n${YELLOW}Test 1b: --multi-agent flag shows deprecation warning${NC}"
node dist/cli.js --multi-agent "test" 2>&1 | grep -q "WARNING: --multi-agent flag is deprecated" && \
  echo -e "${GREEN}✓ PASSED${NC}: Multi-agent deprecation warning shown" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: Multi-agent deprecation warning not shown" && ((FAILED++)))

echo ""
echo "2. Testing REPL integration"
echo "────────────────────────────────────"

# Check if repl.ts exists and has executeWithMultiAgent
echo -e "\n${YELLOW}Test 2a: REPL has executeWithMultiAgent method${NC}"
grep -q "executeWithMultiAgent" src/repl.ts && \
  echo -e "${GREEN}✓ PASSED${NC}: executeWithMultiAgent method found in repl.ts" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: executeWithMultiAgent method not found" && ((FAILED++)))

# Check if two-phase wrapper is removed
echo -e "\n${YELLOW}Test 2b: executeWithTwoPhase wrapper removed${NC}"
grep -q "private async executeWithTwoPhase" src/repl.ts && \
  (echo -e "${RED}✗ FAILED${NC}: executeWithTwoPhase wrapper still exists" && ((FAILED++))) || \
  (echo -e "${GREEN}✓ PASSED${NC}: executeWithTwoPhase wrapper removed" && ((PASSED++)))

echo ""
echo "3. Testing file deletions"
echo "────────────────────────────────────"

# Check deleted files
echo -e "\n${YELLOW}Test 3a: executor.ts deleted${NC}"
[ ! -f "src/executor.ts" ] && \
  echo -e "${GREEN}✓ PASSED${NC}: executor.ts successfully deleted" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: executor.ts still exists" && ((FAILED++)))

echo -e "\n${YELLOW}Test 3b: repl-v2.ts deleted${NC}"
[ ! -f "src/repl-v2.ts" ] && \
  echo -e "${GREEN}✓ PASSED${NC}: repl-v2.ts successfully deleted" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: repl-v2.ts still exists" && ((FAILED++)))

echo -e "\n${YELLOW}Test 3c: agents/two-phase directory deleted${NC}"
[ ! -d "src/agents/two-phase" ] && \
  echo -e "${GREEN}✓ PASSED${NC}: agents/two-phase directory successfully deleted" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: agents/two-phase directory still exists" && ((FAILED++)))

echo ""
echo "4. Testing execution mode routing"
echo "────────────────────────────────────"

# Check if execution mode routing exists
echo -e "\n${YELLOW}Test 4a: Execution mode routing updated${NC}"
grep -q "else if (executionMode === 'two-phase')" src/repl.ts && \
  echo -e "${GREEN}✓ PASSED${NC}: Two-phase execution mode routing exists" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: Two-phase execution mode routing missing" && ((FAILED++)))

echo -e "\n${YELLOW}Test 4b: Multi-agent execution mode routing exists${NC}"
grep -q "else if (executionMode === 'multi-agent')" src/repl.ts && \
  echo -e "${GREEN}✓ PASSED${NC}: Multi-agent execution mode routing exists" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: Multi-agent execution mode routing missing" && ((FAILED++)))

echo ""
echo "5. Testing documentation"
echo "────────────────────────────────────"

# Check documentation files
echo -e "\n${YELLOW}Test 5a: CHANGELOG_AGENT_CONSOLIDATION.md exists${NC}"
[ -f "CHANGELOG_AGENT_CONSOLIDATION.md" ] && \
  echo -e "${GREEN}✓ PASSED${NC}: CHANGELOG exists" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: CHANGELOG missing" && ((FAILED++)))

echo -e "\n${YELLOW}Test 5b: AGENT_CONSOLIDATION_COMPLETE.md exists${NC}"
[ -f "AGENT_CONSOLIDATION_COMPLETE.md" ] && \
  echo -e "${GREEN}✓ PASSED${NC}: Final report exists" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: Final report missing" && ((FAILED++)))

echo -e "\n${YELLOW}Test 5c: Phase completion reports exist${NC}"
([ -f "PHASE2_TWO_PHASE_MERGE_COMPLETE.md" ] && \
 [ -f "PHASE3_MULTI_AGENT_INTEGRATION_COMPLETE.md" ]) && \
  echo -e "${GREEN}✓ PASSED${NC}: Phase reports exist" && ((PASSED++)) || \
  (echo -e "${RED}✗ FAILED${NC}: Phase reports missing" && ((FAILED++)))

echo ""
echo "=========================================="
echo "  Test Summary"
echo "=========================================="
echo -e "${GREEN}PASSED: $PASSED${NC}"
echo -e "${RED}FAILED: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
