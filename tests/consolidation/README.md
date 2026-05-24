# Consolidation Test Suite

**Agent System Consolidation - Benchmark & Integration Tests**

---

## Overview

This directory contains comprehensive tests for the agent system consolidation, verifying:
- Code reduction (1,397 lines deleted)
- System consolidation (4 → 2 agent systems)
- Backward compatibility (0 breaking changes)
- Documentation completeness
- Performance metrics

---

## Quick Start

### Run All Consolidation Tests

```bash
npm run test:consolidation
```

### Run Full Benchmark Suite

```bash
npm run benchmark:consolidation
```

Or run all benchmarks:
```bash
npm run benchmark
```

---

## Test Files

### 1. Integration Tests (`test-consolidation.sh`)

**Purpose**: Verify code changes and file deletions

**Tests** (11 total):
- ✅ CLI deprecation warnings (--two-phase, --multi-agent)
- ✅ executeWithMultiAgent method exists
- ✅ executeWithTwoPhase wrapper removed
- ✅ Deleted files verification (executor.ts, repl-v2.ts, agents/two-phase/)
- ✅ Execution mode routing updated
- ✅ Documentation files exist

**Run**:
```bash
./tests/consolidation/test-consolidation.sh
```

---

### 2. REPL Functionality Tests (`test-repl-features.sh`)

**Purpose**: Test REPL integration and user-facing features

**Tests** (4 total):
- ✅ REPL startup
- ✅ Two-phase mode deprecation warning
- ✅ Multi-agent mode deprecation warning
- ✅ Help command

**Run**:
```bash
./tests/consolidation/test-repl-features.sh
```

---

### 3. Comprehensive Benchmark Suite (`benchmark-consolidation.sh`)

**Purpose**: Complete verification of consolidation with metrics

**Test Categories** (7 categories, 15+ tests):
1. Build Verification
2. Integration Tests
3. REPL Functionality Tests
4. Code Quality Metrics
5. Documentation Verification
6. Backward Compatibility Tests
7. Performance Metrics

**Run**:
```bash
npm run benchmark:consolidation
```

**Expected Output**:
```
╔══════════════════════════════════════════════════════════════╗
║     Agent Consolidation - Benchmark Suite                  ║
╚══════════════════════════════════════════════════════════════╝

1. Build Verification
══════════════════════════════════════════════════════════════

[... tests ...]

══════════════════════════════════════════════════════════════
                    Benchmark Results
══════════════════════════════════════════════════════════════

Total Tests: 15
Passed: 15
Failed: 0

Pass Rate: 100%

Duration: 45s

🎉 ALL BENCHMARKS PASSED!

Consolidation Status:
  ✅ Code reduction: 1,397 lines (28%)
  ✅ Systems consolidated: 4 → 2
  ✅ Breaking changes: 0
  ✅ Backward compatibility: 100%
  ✅ Documentation: Complete

✅ System ready for production deployment
```

---

## Test Organization

```
tests/consolidation/
├── README.md                          # This file
├── test-consolidation.sh              # Integration tests (11 tests)
├── test-repl-features.sh              # REPL functionality tests (4 tests)
├── CONSOLIDATION_TEST_REPORT.md       # Detailed test results
└── benchmark-consolidation.sh         # Comprehensive benchmark suite (root level)
```

---

## NPM Scripts

### Consolidation-Specific Scripts

| Command | Description |
|---------|-------------|
| `npm run test:consolidation` | Run integration + REPL tests |
| `npm run benchmark:consolidation` | Run full benchmark suite |
| `npm run benchmark` | Run all benchmarks (task-tracker + consolidation) |

### General Test Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run Jest unit tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Watch mode for development |

---

## Continuous Integration

### Recommended CI Pipeline

```yaml
# Example GitHub Actions workflow
- name: Run consolidation tests
  run: npm run test:consolidation

- name: Run benchmark suite
  run: npm run benchmark:consolidation

- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: tests/consolidation/
```

---

## Test Results

### Latest Results (2026-01-31)

**Integration Tests**: ✅ 11/11 passed (100%)
**REPL Tests**: ✅ 4/4 passed (100%)
**Overall**: ✅ 15/15 passed (100%)

**Code Reduction**: 1,397 lines (28%)
**Systems Consolidated**: 4 → 2
**Breaking Changes**: 0
**Backward Compatibility**: 100%

### Detailed Report

See `CONSOLIDATION_TEST_REPORT.md` for complete test documentation.

---

## Troubleshooting

### Build Failures

**Issue**: Build shows TypeScript errors

**Solution**:
```bash
# Check if errors are in self-healing (unrelated)
npm run build 2>&1 | grep "error TS"

# Should see 8 errors in src/self-healing/ only
# If more errors, consolidation may have introduced issues
```

### Test Failures

**Issue**: Integration tests fail

**Solution**:
```bash
# Run tests individually to identify failure
./tests/consolidation/test-consolidation.sh

# Check test logs
cat /tmp/consol-test.log
cat /tmp/repl-test.log
```

### REPL Tests Timeout

**Issue**: REPL tests timeout after 5 seconds

**Solution**:
```bash
# Increase timeout in test-repl-features.sh
timeout 10 node dist/cli.js -i
```

---

## Maintenance

### Adding New Tests

1. Create new test script in `tests/consolidation/`
2. Add to `benchmark-consolidation.sh`:
   ```bash
   run_test_suite "My New Test" "./tests/consolidation/my-test.sh > /tmp/my-test.log 2>&1"
   ```
3. Update this README with test description

### Updating Documentation

When consolidation changes:
1. Update test counts in this README
2. Update `CONSOLIDATION_TEST_REPORT.md`
3. Update expected results in `benchmark-consolidation.sh`

---

## Related Documentation

- **Project Root**:
  - `AGENT_CONSOLIDATION_COMPLETE.md` - Complete consolidation summary
  - `CHANGELOG_AGENT_CONSOLIDATION.md` - Migration guide
  - `PHASE2_TWO_PHASE_MERGE_COMPLETE.md` - Phase 2 details
  - `PHASE3_MULTI_AGENT_INTEGRATION_COMPLETE.md` - Phase 3 details

- **This Directory**:
  - `CONSOLIDATION_TEST_REPORT.md` - Detailed test report

---

## Support

### Questions?

- Check `CONSOLIDATION_TEST_REPORT.md` for detailed test information
- Review `AGENT_CONSOLIDATION_COMPLETE.md` for consolidation overview
- See `CHANGELOG_AGENT_CONSOLIDATION.md` for migration guide

### Issues?

If tests fail unexpectedly:
1. Check build status (should have 8 pre-existing errors only)
2. Run tests individually to isolate failures
3. Review test logs in `/tmp/`
4. Verify dist/ directory exists and is up-to-date

---

**Last Updated**: 2026-01-31
**Test Version**: 1.0
**Status**: ✅ All Tests Passing
**Maintainer**: Claude Code Analysis
