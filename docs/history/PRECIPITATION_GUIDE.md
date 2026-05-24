# Precipitation System - User Guide

## 🎯 What is the Precipitation System?

The **Precipitation System** (经验沉淀系统) automatically learns from your coding sessions and creates reusable skills. Think of it as an AI assistant that watches how you work, identifies patterns, and packages them into shareable knowledge nuggets.

**Key Benefits**:
- ✅ **Automatic Learning**: No manual documentation required
- ✅ **AI-Powered**: Smart pattern recognition across your entire codebase
- ✅ **Human-in-the-Loop**: You approve what becomes a skill
- ✅ **Continuous Improvement**: Gets better over time

---

## 🚀 Quick Start

### 1. Enable the System

The system is **enabled by default**. To configure it, edit `settings.json`:

```json
{
  "precipitation": {
    "enabled": true,
    "schedule": "0 2 * * *",
    "confidenceThreshold": 0.6
  }
}
```

### 2. Start Coding

Use Newma normally. The system works in the background:
- Tracks your coding patterns
- Records error fixes
- Learns preferences
- Identifies best practices

### 3. Review Generated Skills

After the first run (default: daily at 2 AM), check your drafts:

```bash
npx newma-cli -i

> /drafts
```

### 4. Approve Good Skills

```bash
> /view-draft error-handling-best-practices
> /approve error-handling-best-practices Great skill!
```

---

## 📋 Commands Reference

### `/drafts [filter]`

List all skill drafts.

**Filters**:
- `--pending` - Show only pending drafts (default)
- `--approved` - Show approved skills
- `--rejected` - Show rejected skills

**Examples**:
```bash
> /drafts
> /drafts --pending
> /drafts --approved
```

**Output**:
```
📝 Skill Drafts

📋 [1] Error Handling Best Practices
   Common error handling patterns in Node.js
   ID: error-handling-best-practices | Confidence: 92.0%
   Created: 2/1/2026 | Type: knowledge

📋 [2] TypeScript Type Guards
   Techniques for runtime type checking
   ID: typescript-type-guards | Confidence: 78.0%
   Created: 2/1/2026 | Type: knowledge

Total: 2 draft(s)
```

---

### `/approve <draft-id> [note]`

Approve a draft and move it to the active skills library.

**Parameters**:
- `draft-id` - The ID of the draft (from `/drafts` output)
- `note` - Optional review note

**Examples**:
```bash
> /approve error-handling-best-practices
> /approve typescript-type-guards "Very useful!"
```

**What Happens**:
1. Draft moves from `drafts/` to `approved/`
2. Skill becomes available for future AI queries
3. Review note is saved in skill file

---

### `/reject <draft-id> [note]`

Reject a draft.

**Parameters**:
- `draft-id` - The ID of the draft
- `note` - Optional reason for rejection

**Examples**:
```bash
> /reject low-quality-pattern
> /reject outdated-practice "This is outdated"
```

**What Happens**:
1. Draft moves from `drafts/` to `rejected/`
2. Skill won't be suggested by AI
3. Review note is saved for reference

---

### `/view-draft <draft-id>`

View full details of a draft.

**Parameters**:
- `draft-id` - The ID of the draft

**Example**:
```bash
> /view-draft error-handling-best-practices
```

**Output**:
```
📄 Error Handling Best Practices

Common error handling patterns in Node.js

Type: knowledge
Complexity: 3/5
Confidence: 92.0%
Tags: error-handling, nodejs, best-practices
Status: pending
Created: 2/1/2026, 11:49:34 PM

Core Knowledge:
Error Handling Principles

1. Always catch async errors
2. Use specific error types
3. Provide meaningful error messages
4. Log errors for debugging

Examples:

[1] Reading a file
Use try-catch with fs.promises

try { const data = await readFile(path); } catch (error) { handleError(error); }
```

---

### `/delete-draft <draft-id>`

Permanently delete a draft.

**Parameters**:
- `draft-id` - The ID of the draft

**Example**:
```bash
> /delete-draft bad-skill
```

**Warning**: This cannot be undone!

---

### `/precipitate`

Manually trigger a precipitation run.

**When to Use**:
- Test the system
- Generate skills immediately after intense coding
- Debug precipitation issues

**Example**:
```bash
> /precipitate

⏰ Triggering precipitation...

✅ Precipitation completed
Suggestions generated: 2
Drafts saved: 2
Duration: 15234ms
```

---

### `/precipitation-status`

Show overall system status.

**Example**:
```bash
> /precipitation-status

⚙️  Precipitation System Status

Status: 🟢 Running
Next run: 2/2/2026, 2:00:00 AM
Last run: 2/1/2026, 2:00:00 AM

📊 Draft Statistics
Pending: 2
Approved: 15
Rejected: 3
Avg Confidence: 82.3%
```

---

### `/precipitation-schedule`

Show when the next run is scheduled.

**Example**:
```bash
> /precipitation-schedule

⏰ Precipitation Schedule

Next scheduled run:
2/2/2026, 2:00:00 AM
(5h 23m from now)
```

---

## ⚙️ Configuration

### Basic Settings

Edit `settings.json`:

```json
{
  "precipitation": {
    "enabled": true,
    "schedule": "0 2 * * *",
    "confidenceThreshold": 0.6,
    "maxDailySkills": 5,
    "draftRetentionDays": 30
  }
}
```

### Advanced Settings

```json
{
  "precipitation": {
    "enabled": true,
    "schedule": "0 2 * * *",
    "confidenceThreshold": 0.6,
    "maxDailySkills": 5,
    "draftRetentionDays": 30,
    "autoApproveBelow": 0.95,
    "autoRejectAbove": 0.4,
    "analysisDays": 7
  }
}
```

**Settings Explained**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the system |
| `schedule` | string | `"0 2 * * *"` | Cron expression for when to run |
| `confidenceThreshold` | number | `0.6` | Minimum confidence (0.0-1.0) to save a skill |
| `maxDailySkills` | number | `5` | Maximum skills to generate per run |
| `draftRetentionDays` | number | `30` | How long to keep unapproved drafts |
| `autoApproveBelow` | number | - | Auto-approve if confidence > this value |
| `autoRejectAbove` | number | - | Auto-reject if confidence < this value |
| `analysisDays` | number | `7` | Days of history to analyze |

---

## 🎨 Customizing Schedule

### Cron Expression Format

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

### Common Schedules

```json
"daily at 2 AM":     "0 2 * * *"
"every 6 hours":     "0 */6 * * *"
"weekly on Sunday":  "0 0 * * 0"
"monthly on 1st":    "0 0 1 * *"
"every 30 minutes":  "*/30 * * * *"
"at noon":           "0 12 * * *"
```

### Examples

**Run every morning at 9 AM**:
```json
{
  "precipitation": {
    "schedule": "0 9 * * *"
  }
}
```

**Run every Monday at 8 AM**:
```json
{
  "precipitation": {
    "schedule": "0 8 * * 1"
  }
}
```

**Run every 6 hours**:
```json
{
  "precipitation": {
    "schedule": "0 */6 * * *"
  }
}
```

---

## 🧠 How Skills Are Generated

### Step 1: Data Collection

The system collects data from 7 memory systems:

1. **Errors**: What errors occurred and how they were fixed
2. **History**: Commands executed and their outcomes
3. **Preferences**: Your settings and choices
4. **Context**: Project structure and files
5. **Reasoning**: AI reasoning traces from planning
6. **Decisions**: Decision records from various stages
7. **Sessions**: Session history and patterns

### Step 2: AI Analysis

OpenAI analyzes the collected data to identify:
- **Repeated patterns**: Things you do regularly
- **Best practices**: Approaches that work well
- **Error solutions**: Common fixes and their patterns
- **Tech preferences**: Frameworks and tools you use
- **Coding style**: Your naming and structure conventions

### Step 3: Skill Extraction

The AI generates structured skills with:
- Name and description
- Type (knowledge/action/analysis)
- Complexity level (1-5)
- Relevant tags
- Confidence score (0.0-1.0)
- Core knowledge
- Usage scenarios
- Code examples
- Supporting evidence

### Step 4: Filtering

Skills are filtered based on:
- **Confidence threshold**: Low-confidence skills are discarded
- **Max daily limit**: Only top N skills by confidence
- **Auto-approve/reject**: Optional automatic decisions
- **Uniqueness**: Duplicate skills are merged

### Step 5: Draft Creation

Approved skills are saved as drafts in `.kode/skills/drafts/`:
- YAML Frontmatter with metadata
- Markdown content with explanations
- Evidence references
- Examples and code snippets

---

## 📊 Skill Quality

### Confidence Scores

Each skill has a confidence score (0.0-1.0):

| Range | Quality | Action |
|-------|---------|--------|
| 0.9-1.0 | Excellent | Likely approve |
| 0.7-0.9 | Good | Review carefully |
| 0.5-0.7 | Fair | Review critically |
| 0.0-0.5 | Poor | Likely reject |

**What Affects Confidence**:
- **Evidence count**: More occurrences = higher confidence
- **Pattern consistency**: Consistent patterns = higher confidence
- **Success rate**: Approaches that work well = higher confidence
- **Recency**: Recent patterns = slightly higher confidence
- **Clarity**: Well-defined patterns = higher confidence

### Improving Skill Quality

**To get better skills**:

1. **Code consistently**: Use the same patterns for similar problems
2. **Add explanations**: Use `/plan` for complex tasks (creates reasoning traces)
3. **Review errors**: Fix errors properly (not just workarounds)
4. **Document decisions**: The system learns from your decision records
5. **Set appropriate thresholds**:
   - Too low (0.4): Lots of low-quality skills
   - Too high (0.9): Very few skills
   - Sweet spot (0.6-0.7): Balanced quality and quantity

---

## 🔧 Troubleshooting

### No Skills Generated

**Problem**: Precipitation runs but generates 0 skills

**Solutions**:
1. **Lower confidence threshold**:
   ```json
   { "confidenceThreshold": 0.4 }
   ```

2. **Increase analysis window**:
   ```json
   { "analysisDays": 30 }
   ```

3. **Check you have data**:
   ```bash
   > /status
   # Check command count > 0
   ```

4. **Verify API key**:
   ```bash
   echo $OPENAI_API_KEY
   ```

### Too Many Skills

**Problem**: Generating too many low-quality skills

**Solutions**:
1. **Raise confidence threshold**:
   ```json
   { "confidenceThreshold": 0.7 }
   ```

2. **Limit daily skills**:
   ```json
   { "maxDailySkills": 3 }
   ```

3. **Enable auto-reject**:
   ```json
   { "autoRejectAbove": 0.5 }
   ```

### System Not Running

**Problem**: `/precipitation-status` shows "Stopped"

**Solutions**:
1. **Check enabled**:
   ```json
   { "enabled": true }
   ```

2. **Verify cron expression**:
   ```json
   { "schedule": "0 2 * * *" }
   ```

3. **Check for errors**:
   ```bash
   # Look for error messages on startup
   npx newma-cli -i
   ```

### High API Costs

**Problem**: Precipitation using too many tokens

**Solutions**:
1. **Reduce analysis days**:
   ```json
   { "analysisDays": 3 }
   ```

2. **Increase confidence threshold**:
   ```json
   { "confidenceThreshold": 0.8 }
   ```

3. **Run less frequently**:
   ```json
   { "schedule": "0 2 * * 0" }  # Weekly instead of daily
   ```

---

## 💡 Best Practices

### 1. Review Drafts Regularly

Check drafts frequently to avoid backlog:
```bash
> /drafts
```

### 2. Provide Good Feedback

When approving/rejecting, add notes:
```bash
> /approve great-skill "This is exactly what I needed!"
> /reject bad-skill "Outdated approach"
```

These notes help improve future skill generation.

### 3. Start Conservative

Begin with higher thresholds, then adjust:
```json
{
  "confidenceThreshold": 0.7,  // Start high
  "maxDailySkills": 3
}
```

After 1-2 weeks, lower if you want more skills.

### 4. Use Manual Trigger

After intense coding sessions:
```bash
> /precipitate
```

This captures patterns while they're fresh.

### 5. Clean Up Old Drafts

Periodically review old drafts:
```bash
> /drafts --pending
# Review and approve/delete old drafts
```

Older drafts are automatically deleted after `draftRetentionDays`.

---

## 📈 Real-World Examples

### Example 1: Error Handling Pattern

**Coding Pattern**:
```typescript
// You consistently write error handling like this
try {
  const data = await readFile(path);
  processData(data);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found');
  } else {
    throw error;
  }
}
```

**Generated Skill**:
```
Name: Node.js File Error Handling
Confidence: 0.91
Type: knowledge

Pattern: Check error.code for specific file errors
Common codes: ENOENT, EACCES, EISDIR
```

### Example 2: Testing Convention

**Coding Pattern**:
```typescript
// You always name test files like this
describe('UserService', () => {
  it('should create user', async () => {
    // ...
  });
});
```

**Generated Skill**:
```
Name: Jest Test Naming Convention
Confidence: 0.88
Type: knowledge

Pattern: describe('ClassName', ...)
Match test file: ClassName.test.ts
```

### Example 3: React Component Pattern

**Coding Pattern**:
```typescript
// You consistently structure components like this
interface Props {
  title: string;
  onAction: () => void;
}

export const MyComponent: React.FC<Props> = ({ title, onAction }) => {
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  );
};
```

**Generated Skill**:
```
Name: TypeScript React Component Structure
Confidence: 0.94
Type: knowledge

Pattern: Define Props interface, use React.FC<Props>
Destructure props in parameters
```

---

## 🎓 Advanced Usage

### Custom Skill Categories

Influence skill types by your coding patterns:
- **Knowledge**: Best practices, conventions, patterns
- **Action**: Step-by-step procedures, workflows
- **Analysis**: Decision frameworks, evaluation methods

### Skill Chaining

The system can suggest related skills:
```bash
> /plan refactor authentication
# AI might suggest reviewing approved skills:
# - "JWT Token Validation" (approved skill)
# - "Password Hashing Best Practices" (approved skill)
```

### Exporting Skills

Approved skills are in `.kode/skills/approved/`:
```
.kode/skills/approved/
├── error-handling/
│   └── SKILL.md
├── react-patterns/
│   └── SKILL.md
└── testing-conventions/
    └── SKILL.md
```

You can:
- Share skills with your team
- Version control in git
- Build a knowledge base
- Use in documentation

---

## 🚀 Performance Tips

### For Large Codebases

```json
{
  "analysisDays": 3,
  "maxDailySkills": 10,
  "confidenceThreshold": 0.7
}
```

### For Small Projects

```json
{
  "analysisDays": 30,
  "maxDailySkills": 3,
  "confidenceThreshold": 0.5
}
```

### For Frequent Runs

```json
{
  "schedule": "*/30 * * * *",  // Every 30 minutes
  "analysisDays": 1,
  "maxDailySkills": 2
}
```

### For Learning Phase

```json
{
  "confidenceThreshold": 0.4,
  "autoRejectAbove": 0.3,
  "draftRetentionDays": 60
}
```

---

## 📚 Further Reading

- **Technical Docs**: See `PRECIPITATION_SYSTEM.md`
- **Source Code**: `src/memory/`
- **Tests**: `test-precipitation.ts`

---

## 🤝 Contributing

The precipitation system is part of Newma Core. To contribute:

1. **Report Issues**: GitHub Issues
2. **Suggest Features**: GitHub Discussions
3. **Submit PRs**: Follow contributing guidelines

---

**Version**: 1.0.0
**Last Updated**: 2026-02-02
**Author**: Newma Development Team
