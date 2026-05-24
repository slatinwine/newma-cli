# Self-Healing System for Newma

An intelligent self-healing system that enables Newma to automatically detect issues, generate specialized tools, and repair problems.

## Features

### 🔍 Automatic Issue Detection
- Analyzes execution patterns in real-time
- Detects recurring errors and failures
- Categorizes issues by type and severity
- Identifies performance bottlenecks

### 🤖 AI-Powered Diagnosis
- Root cause analysis using AI
- Suggests multiple repair strategies
- Estimates success confidence
- Recommends optimal actions

### 🛠️ Dynamic Tool Generation
- Creates specialized tools for recurring patterns
- Validates tool specifications
- Saves tools securely to files
- Integrates with existing tool registry

### 🔧 Self-Repair Capabilities
- Automatic fix execution (when safe)
- Rollback checkpoints before changes
- Post-repair verification
- Repair history tracking

### 📚 Learning System
- Records all repairs and outcomes
- Improves suggestions over time
- Avoids repeating failed repairs
- Prioritizes effective solutions

## Quick Start

### Enable Self-Healing

Add to `settings.json`:

```json
{
  "selfHealing": {
    "enabled": true,
    "autoRepair": false,
    "autoToolCreation": true
  }
}
```

### Interactive Usage

```bash
# Start Newma with self-healing enabled
npx newma-cli -i

# Diagnose an issue
[newma] ❯ /diagnose "keep getting timeout errors"

# Request tool creation
[newma] ❯ /create-tool "create a tool to retry failed API calls"

# Check system health
[newma] ❯ /health-check

# View self-healing stats
[newma] ❯ /self-heal
```

## Architecture

```
User/System Error
       ↓
┌──────────────────┐
│  IssueDetector   │  Analyzes patterns
│                  │  Detects issues
└────────┬─────────┘
         ↓
┌──────────────────┐
│    Diagnosis     │  AI-powered analysis
│                  │  Suggested actions
└────────┬─────────┘
         ↓
    ┌────┴────┐
    ↓         ↓
┌────────┐  ┌──────────────┐
│ Repair │  │ToolGenerator │
│ Engine │  │              │
└────────┘  └──────────────┘
    ↓             ↓
    └─────┬───────┘
          ↓
    ┌──────────┐
    │ Learning │  Records outcomes
    │ System   │  Improves over time
    └──────────┘
```

## Components

### IssueDetector
Monitors execution history and identifies patterns:
- Error frequency analysis
- Pattern recognition
- Severity assessment
- Root cause inference

### ToolGenerator
Creates specialized tools using AI:
- Natural language → Tool specification
- TypeScript code generation
- Validation and testing
- Safe file-based storage

### RepairEngine
Executes repairs safely:
- Rollback checkpoints
- Risk-based action filtering
- Post-repair verification
- History tracking

### SelfHealingManager
Main orchestrator coordinating all components

## Usage Examples

### Example 1: Auto-generated Tool for Repeated Errors

**Problem**: Frequently getting "file not found" errors when reading config files.

**Detection**:
```
[SelfHealing] 🔍 High-frequency pattern detected: file_not_found (5 occurrences)
```

**Diagnosis**:
```
[newma] ❯ /diagnose "config file not found"

📊 Diagnosis Result:
  Issue: config file not found
  Category: tool_error
  Severity: medium
  Root Cause: Missing file validation
  Confidence: 85%

💡 Suggested Actions:
  1. [create_tool] Create tool with file existence check (Priority: 90%)
```

**Solution**:
```
[newma] ❯ /create-tool "create a tool that checks if file exists before reading"

[ToolGenerator] 🛠️  Generating tool...
✅ Tool created: file-exists-checker
✅ Tool saved to: .kode/self-healing/tools/file-exists-checker.ts
```

### Example 2: Auto-Repair with Verification

**Problem**: API timeouts during batch operations.

**Auto-diagnosis** (if `autoRepair: true`):
```
[SelfHealing] 🔍 Detected timeout pattern
[SelfHealing] 🔧 Attempting auto-repair...
[RepairEngine] ✅ Applied retry logic with exponential backoff
[RepairEngine] ✅ Verification passed
[SelfHealing] ✅ Auto-repair successful
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Master switch for self-healing |
| `autoRepair` | boolean | `false` | Auto-fix without confirmation |
| `autoToolCreation` | boolean | `false` | Auto-generate tools |
| `learningEnabled` | boolean | `true` | Learn from repairs |
| `maxAutoFixRisk` | string | `"low"` | Risk limit for auto-fix |
| `minConfidenceThreshold` | number | `0.7` | Min confidence for auto-action |
| `patternRetentionDays` | number | `30` | Pattern data retention |

## Safety Features

✅ **Rollback Protection**: Every repair creates a git checkpoint
✅ **Risk Assessment**: Actions categorized by risk level
✅ **User Confirmation**: High-risk actions require approval
✅ **Validation**: All tools validated before use
✅ **Verification**: Repairs verified before completion
✅ **Secure Storage**: Tools saved to files, not eval'd

## Learning Data

Stored in `.kode/self-healing/learning.json`:

```json
[
  {
    "pattern": {
      "id": "pattern_123",
      "category": "api_failure",
      "pattern": "timeout error",
      "frequency": 5,
      "lastOccurrence": "2026-01-31T10:00:00Z"
    },
    "fixApplied": {
      "type": "modify_code",
      "description": "Add retry logic"
    },
    "success": true,
    "timestamp": "2026-01-31T10:05:00Z"
  }
]
```

## API Reference

### SelfHealingManager

```typescript
// Initialize
const manager = new SelfHealingManager(
  tracker,
  rollbackManager,
  verifier,
  config,
  selfHealingConfig
);
await manager.initialize();

// Process execution
await manager.processExecution(record);

// Diagnose issue
const diagnosis = await manager.diagnose("error message");

// Create tool
const success = await manager.createTool("tool description", config);

// Health check
const health = await manager.healthCheck();

// Statistics
const stats = manager.getStats();
```

## File Structure

```
src/self-healing/
├── types.ts           # Type definitions
├── detector.ts        # Issue detection engine
├── tool-generator.ts  # AI-powered tool generator
├── repair-engine.ts   # Repair execution engine
├── manager.ts         # Main orchestrator
└── index.ts           # Exports

.kode/self-healing/
├── tools/             # Auto-generated tools
├── data/              # Learning data
└── learning.json      # Learning records
```

## Future Enhancements

- [ ] Predictive issue detection
- [ ] Collaborative learning across projects
- [ ] Tool marketplace/sharing
- [ ] ML-based pattern recognition
- [ ] Cross-project knowledge transfer
- [ ] Visual repair dashboard
- [ ] Automated testing of generated tools

## Contributing

To extend the self-healing system:

1. **New Detectors**: Add pattern detection logic in `detector.ts`
2. **Repair Strategies**: Add new action types in `repair-engine.ts`
3. **Tool Templates**: Add generation templates in `tool-generator.ts`
4. **Learning Algorithms**: Improve learning in `manager.ts`

## License

MIT - See LICENSE file for details
