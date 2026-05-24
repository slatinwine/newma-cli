# Newma (牛码) v3.0.0 - Usage Examples

This document provides practical examples of using Newma (牛码) with all 4 specialized agents.

## Table of Contents

- [Basic Examples](#basic-examples)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Testing](#testing)
- [Documentation](#documentation)
- [Full-Stack Projects](#full-stack-projects)
- [Advanced Scenarios](#advanced-scenarios)

## Basic Examples

### Quick Bug Fix

```bash
# Fix a simple bug without multi-agent
npx newma-cli "fix the memory leak in the useEffect hook"
```

### Simple Feature Addition

```bash
# Add a feature with single agent
npx newma-cli "add a dark mode toggle to the settings page"
```

## Frontend Development

### React Component Development

```bash
# Create a new component with styling
npx newma-cli --multi-agent "create a responsive navigation bar with mobile menu, logo, and dropdown items"
```

**Expected Output:**
```
🤖 Planning multi-agent strategy...
📋 Plan: 3 tasks in 2 groups

1. [frontend] Create navigation bar component structure
   Priority: high, Agent: frontend-agent
2. [frontend] Add responsive CSS with mobile breakpoints
   Priority: high, Agent: frontend-agent
3. [frontend] Add mobile menu toggle functionality
   Priority: medium, Agent: frontend-agent

Execute this multi-agent plan? ✓

[Frontend Specialist] Processing: Create navigation bar component...
✅ [Frontend Specialist] Completed: Create navigation bar component
```

### UI Refactoring

```bash
# Refactor components for better performance
npx newma-cli --multi-agent --verify \
  "convert class components to functional components with hooks and optimize re-renders"
```

### State Management Setup

```bash
# Add Redux or Zustand for state management
npx newma-cli --multi-agent \
  "implement a shopping cart with Zustand, including persistence and actions"
```

## Backend Development

### API Endpoint Creation

```bash
# Create REST API endpoints
npx newma-cli --multi-agent --verify \
  "create REST API endpoints for user CRUD operations with validation and error handling"
```

**Expected Output:**
```
🤖 Planning multi-agent strategy...
📋 Plan: 4 tasks in 2 groups

1. [backend] Design user model and validation schema
   Priority: high, Agent: backend-agent
2. [backend] Create user routes and controller
   Priority: high, Agent: backend-agent
3. [backend] Implement CRUD operations
   Priority: high, Agent: backend-agent
4. [testing] Write unit tests for user endpoints
   Priority: medium, Agent: testing-agent

Execute this multi-agent plan? ✓
```

### Database Integration

```bash
# Setup database with Prisma
npx newma-cli --multi-agent --verify \
  "setup Prisma with PostgreSQL and create database schema for a blog platform"
```

### Authentication System

```bash
# Add JWT authentication
npx newma-cli --multi-agent --verify \
  "implement JWT authentication with refresh tokens, password reset, and email verification"
```

## Testing

### Unit Tests

```bash
# Write unit tests for a service
npx newma-cli --multi-agent \
  "write comprehensive unit tests for the UserService with 80% coverage using Jest"
```

**What Testing Agent Does:**
- Creates test files following naming conventions
- Implements test cases for happy paths
- Adds tests for edge cases and error scenarios
- Uses appropriate mocking strategies
- Follows AAA pattern (Arrange, Act, Assert)

### Integration Tests

```bash
# Test API integration
npx newma-cli --multi-agent \
  "create integration tests for the authentication API flow"
```

### E2E Tests

```bash
# Create Cypress E2E tests
npx newma-cli --multi-agent \
  "write E2E tests for the user registration and login flow using Cypress"
```

### Test Coverage Improvement

```bash
# Improve test coverage
npx newma-cli --multi-agent --verify \
  "increase test coverage to 90% by adding missing test cases"
```

## Documentation

### API Documentation

```bash
# Generate API documentation
npx newma-cli --multi-agent \
  "create OpenAPI/Swagger documentation for all REST endpoints"
```

**What Documentation Agent Does:**
- Extracts endpoint information from code
- Generates OpenAPI specification
- Adds request/response examples
- Documents authentication requirements
- Includes error response codes

### README Creation

```bash
# Create comprehensive README
npx newma-cli --multi-agent \
  "write a detailed README with installation, usage, examples, and contribution guidelines"
```

### Code Comments

```bash
# Add inline documentation
npx newma-cli --multi-agent \
  "add JSDoc comments to all exported functions with parameter descriptions and return types"
```

### Architecture Documentation

```bash
# Document system architecture
npx newma-cli --multi-agent \
  "create architecture documentation explaining the system design, data flow, and key decisions"
```

## Full-Stack Projects

### Complete Feature Development

```bash
# Build a complete feature with all agents
npx newma-cli --multi-agent --use-tools --permission-level standard --verify \
  "build a comment system with:
  - Frontend: Comment form and display component
  - Backend: API endpoints for CRUD operations
  - Database: Comment schema and relationships
  - Testing: Unit and integration tests
  - Documentation: API docs and usage examples"
```

**Execution Flow:**
```
1. [Backend Agent] Designs database schema
2. [Backend Agent] Creates API endpoints
3. [Frontend Agent] Builds comment UI
4. [Testing Agent] Writes tests
5. [Documentation Agent] Documents API

📊 Multi-Agent Execution Summary
===
Total tasks: 5
Successful: 5
===
```

### MVP Development

```bash
# Build a minimum viable product
npx newma-cli --multi-agent --use-tools --permission-level standard --verify \
  "create a task management MVP with:
  - User authentication
  - Task CRUD operations
  - Task status management
  - Basic testing
  - Documentation"
```

## Advanced Scenarios

### Refactoring with Tests

```bash
# Refactor code and update tests
npx newma-cli --multi-agent --verify \
  "refactor the payment processing system to use strategy pattern and update all tests"
```

### Migration Project

```bash
# Migrate from one technology to another
npx newma-cli --multi-agent --verify \
  "migrate from Express to Fastify, updating all routes, middleware, and tests"
```

### Performance Optimization

```bash
# Optimize performance across the stack
npx newma-cli --multi-agent --verify \
  "optimize the application performance by:
  - Frontend: Implement code splitting and lazy loading
  - Backend: Add database query optimization
  - Testing: Add performance benchmarks
  - Documentation: Document optimization techniques"
```

### Security Hardening

```bash
# Improve security
npx newma-cli --multi-agent --permission-level standard --verify \
  "harden the application security by:
  - Adding input validation and sanitization
  - Implementing rate limiting
  - Adding CORS configuration
  - Writing security tests
  - Documenting security best practices"
```

## Agent-Specific Examples

### Using Only Frontend Agent

```bash
# Frontend-focused task
npx newma-cli --multi-agent \
  "create a responsive dashboard with charts and data visualization"
```

### Using Only Backend Agent

```bash
# Backend-focused task
npx newma-cli --multi-agent \
  "implement WebSocket server for real-time notifications"
```

### Using Only Testing Agent

```bash
# Testing-focused task
npx newma-cli --multi-agent \
  "add property-based testing using FastCheck for critical business logic"
```

### Using Only Documentation Agent

```bash
# Documentation-focused task
npx newma-cli --multi-agent \
  "create a comprehensive contributor guide with coding standards and PR guidelines"
```

## Combined Features

### Multi-Agent + Verification

```bash
# Use multiple agents with automatic verification
npx newma-cli --multi-agent --verify \
  "add user profile management with avatar upload"
```

### Multi-Agent + Custom Permissions

```bash
# Dangerous operations with higher permission level
npx newma-cli --multi-agent --permission-level dangerous \
  "delete all temporary files and clean up the project"
```

### Multi-Agent + Tool System

```bash
# Explicitly enable tool system
npx newma-cli --multi-agent --use-tools \
  "setup the project with ESLint, Prettier, and Husky"
```

### All Features Combined

```bash
# Full feature set
npx newma-cli --multi-agent --use-tools --permission-level standard --verify \
  "build a complete feature from scratch with testing and documentation"
```

## Tips and Best Practices

### 1. Start Simple, Add Complexity

```bash
# Start with basic implementation
npx newma-cli "add a login form"

# Then add complexity with multiple agents
npx newma-cli --multi-agent "add OAuth2 social login providers"
```

### 2. Use Verification for Critical Code

```bash
# Always verify critical paths
npx newma-cli --multi-agent --verify \
  "implement payment processing with Stripe"
```

### 3. Leverage Testing Agent

```bash
# Always ask for tests
npx newma-cli --multi-agent \
  "add a new feature and write comprehensive tests for it"
```

### 4. Document as You Go

```bash
# Generate documentation alongside features
npx newma-cli --multi-agent \
  "create API endpoints with inline comments and API documentation"
```

### 5. Break Down Large Tasks

```bash
# Large task broken into smaller requirements
npx newma-cli --multi-agent \
  "Phase 1: Design the database schema"

npx newma-cli --multi-agent \
  "Phase 2: Implement API endpoints based on the schema"
```

## Real-World Workflows

### Workflow 1: New Feature Development

```bash
# 1. Initial implementation
npx newma-cli --multi-agent "add user comments feature"

# 2. Add tests
npx newma-cli --multi-agent "write tests for the comment feature"

# 3. Add documentation
npx newma-cli --multi-agent "document the comment API"

# 4. Verify everything
npx newma-cli --multi-agent --verify "ensure comment feature works end-to-end"
```

### Workflow 2: Bug Fix with Tests

```bash
# 1. Fix the bug
npx newma-cli --multi-agent "fix the race condition in the order processing"

# 2. Add regression tests
npx newma-cli --multi-agent "add tests to prevent this race condition"

# 3. Verify fix
npx newma-cli --multi-agent --verify "confirm the bug is fixed and tests pass"
```

### Workflow 3: Code Review Improvements

```bash
# 1. Address review comments
npx newma-cli --multi-agent "refactor based on PR review feedback"

# 2. Update tests
npx newma-cli --multi-agent "update tests to cover the refactored code"

# 3. Update documentation
npx newma-cli --multi-agent "update docs to reflect the changes"

# 4. Final verification
npx newma-cli --multi-agent --verify "run full test suite and build"
```

## Common Use Cases

### 1. Project Setup

```bash
npx newma-cli --multi-agent --use-tools --permission-level standard \
  "initialize a new project with:
  - Project structure
  - ESLint and Prettier
  - TypeScript configuration
  - Testing framework
  - CI/CD configuration
  - Documentation template"
```

### 2. Adding a New Route/Page

```bash
npx newma-cli --multi-agent --verify \
  "add a user settings page with profile editing and password change"
```

### 3. Database Migration

```bash
npx newma-cli --multi-agent --permission-level standard \
  "create a database migration to add user preferences table"
```

### 4. Performance Audit

```bash
npx newma-cli --multi-agent \
  "conduct performance audit and suggest optimizations:
  - Frontend: Bundle size, lazy loading
  - Backend: Query optimization, caching
  - Testing: Add performance tests
  - Documentation: Document findings"
```

### 5. Security Audit

```bash
npx newma-cli --multi-agent --verify \
  "perform security audit and fix vulnerabilities:
  - Check for common security issues
  - Add security headers
  - Implement rate limiting
  - Add security tests
  - Document security measures"
```

## Self-Optimization Examples (Phase 4)

### Analyze Performance

```bash
# Analyze execution history to get insights
npx ts-node src/cli-optimize.ts analyze
```

**Expected Output:**
```
🔍 Newma (牛码) Self-Optimization Analysis

Analyzing performance patterns...

📊 Overall Health: EXCELLENT (90/100)

📈 Performance Metrics:
   Total Tasks: 6
   Success Rate: 83.3%
   Average Time: 775ms
   Failed Tasks: 1

🤖 Agent Performance:
   File Creation Agent:
     Success: 50.0%, Time: 450ms
   File Modification Agent:
     Success: 100.0%, Time: 275ms
   Command Execution Agent:
     Success: 100.0%, Time: 1750ms

✨ Successful Patterns:
   1. Successful sequence: create → modify → run
      Confidence: 100%

💡 Optimization Suggestions:

1. [HIGH] File Creation Agent has low success rate (50.0%)
   Action: Review file creation error handling
   Expected: Improve file creation reliability

2. [MEDIUM] Command Execution Agent is slower than average
   Action: Optimize command execution or use caching
   Expected: Reduce agent execution time
```

### Export Learning Data

```bash
# Export optimization data to JSON
npx ts-node src/cli-optimize.ts analyze --export > optimization-data.json
```

**Use cases:**
- Share performance insights with team
- Analyze trends over time
- Build custom dashboards
- Track project health metrics

### Apply Optimizations

```bash
# Dry run to see what would be optimized
npx ts-node src/cli-optimize.ts optimize --dry-run

# Actually apply automatic optimizations
npx ts-node src/cli-optimize.ts optimize
```

**Expected Output (Dry Run):**
```
⚡ Newma (牛码) Self-Optimization

DRY RUN MODE - No changes will be applied

Optimization Suggestions:
1. [HIGH] File Creation Agent has low success rate
   Action: Review file creation error handling
   Expected: Improve file creation reliability

2. [MEDIUM] Command Execution Agent is slower
   Action: Optimize command execution
   Expected: Reduce agent execution time
```

### Continuous Improvement Workflow

```bash
# 1. Execute tasks
npx newma-cli --multi-agent "add new feature"

# 2. Analyze performance
npx ts-node src/cli-optimize.ts analyze

# 3. Apply optimizations
npx ts-node src/cli-optimize.ts optimize

# 4. Repeat for continuous improvement
```

## Autonomous Mode Examples

### Basic Autonomous Execution

```bash
# Let Newma (牛码) handle everything autonomously
npx newma-cli --autonomous \
  "build a complete REST API with authentication and testing"
```

**Expected Output:**
```
🤖 Autonomous Mode Activated

📋 Phase 1: Strategic Planning
   Tasks: 8
   Groups: 3

⚙️ Phase 2: Autonomous Execution

   Iteration 1/3
      → Create user schema
      → Implement authentication endpoints
      → Add JWT token handling

   Iteration 2/3
      → Fix type errors
      → Update API routes

   Iteration 3/3
      → All tasks passed

✅ Phase 3: Quality Verification
   Verification: PASSED

🧠 Phase 4: Self-Optimization
   Analyzing patterns...

📊 Autonomous Execution Summary
===
Requirement: build a complete REST API with authentication
Status: SUCCESS
Duration: 35.7s
Tasks: 8/8 successful
===
```

### Autonomous with Custom Configuration

```bash
# Autonomous mode with specific settings
npx newma-cli --autonomous \
  --max-iterations 10 \
  --auto-fix true \
  --auto-optimize true \
  --require-confirmation false \
  "create a full-stack blog application"
```

**Configuration Options:**
- `--max-iterations`: Maximum retry attempts (default: 5)
- `--auto-fix`: Automatically fix errors (default: true)
- `--auto-optimize`: Apply performance optimizations (default: true)
- `--require-confirmation`: Ask before execution (default: false)
- `--stop-on-error`: Stop on first error (default: false)

### Autonomous for Complex Projects

```bash
# Large-scale autonomous development
npx newma-cli --autonomous \
  --max-iterations 10 \
  --verbose \
  "build a complete e-commerce platform with:
  - User authentication and authorization
  - Product catalog with search and filters
  - Shopping cart and checkout
  - Payment integration (Stripe)
  - Order management
  - Admin dashboard
  - Comprehensive testing
  - API documentation"
```

**What Autonomous Mode Does:**
1. **Planning**: Breaks down into 20+ subtasks
2. **Execution**: Runs tasks across multiple iterations
3. **Auto-Fix**: Detects and fixes errors automatically
4. **Verification**: Runs tests, lint, and build checks
5. **Optimization**: Analyzes patterns and optimizes performance

### Autonomous with Interactive Confirmation

```bash
# Ask for confirmation before execution
npx newma-cli --autonomous --require-confirmation \
  "refactor the codebase to use TypeScript strict mode"
```

**Output:**
```
🤖 Autonomous Mode Activated

📋 Phase 1: Strategic Planning
   Tasks: 15
   Groups: 5

❓ Execute 15 tasks autonomously? (y/N)
```

### Comparison: Manual vs Autonomous

**Manual Approach:**
```bash
# Step-by-step manual execution
npx newma-cli "create user schema"
npx newma-cli "implement authentication"
npx newma-cli "add API endpoints"
npx newma-cli "write tests"
npx newma-cli "verify everything"
```

**Autonomous Approach:**
```bash
# One command for everything
npx newma-cli --autonomous \
  "build authentication system with tests"
```

**Benefits:**
- ✅ Single command
- ✅ Automatic error recovery
- ✅ Built-in verification
- ✅ Performance optimization
- ✅ Complete execution history

## Combined Phase Features

### Multi-Agent + Verification + Self-Optimization

```bash
# Combine all Phase 2-4 features
npx newma-cli --multi-agent --verify \
  "build a microservice with:
  - Frontend: React UI
  - Backend: Express API
  - Database: MongoDB
  - Testing: Unit + Integration tests
  - Documentation: API docs"

# Then analyze performance
npx ts-node src/cli-optimize.ts analyze

# Apply optimizations
npx ts-node src/cli-optimize.ts optimize
```

### Full Autonomous Workflow

```bash
# Complete autonomous development with optimization
npx newma-cli --autonomous --max-iterations 10 \
  "create a real-time chat application"

# Review execution history
npx ts-node src/cli-optimize.ts analyze

# Export for team review
npx ts-node src/cli-optimize.ts analyze --export > chat-app-metrics.json
```

## Tool System Examples

### Using Custom Tools

```typescript
// Register a custom tool
import { Tool, ToolCategory } from './src/tools/types';

const dockerTool: Tool = {
  name: 'docker',
  description: 'Manage Docker containers',
  category: ToolCategory.SYSTEM,
  permissions: [PermissionLevel.STANDARD],
  parameters: [
    {
      name: 'action',
      type: 'string',
      required: true,
      description: 'Docker action (build, run, stop)'
    }
  ],
  handler: async (params, context) => {
    // Safe execution with execFile
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(execFile);

    try {
      const { stdout } = await execAsync('docker', [params.action], {
        cwd: context.projectRoot,
        timeout: 60000
      });

      return {
        success: true,
        output: stdout
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Register and use
registry.register(dockerTool);
```

### Parallel Tool Execution

```typescript
// Execute multiple tools in parallel
const results = await toolExecutor.executeParallel([
  {
    tool: 'file',
    parameters: {
      operation: 'create',
      path: 'src/components/Header.tsx',
      content: '...'
    }
  },
  {
    tool: 'file',
    parameters: {
      operation: 'create',
      path: 'src/components/Footer.tsx',
      content: '...'
    }
  },
  {
    tool: 'command',
    parameters: {
      command: 'npm run build'
    }
  }
]);

console.log(`Executed ${results.length} tasks in parallel`);
```

## Performance Monitoring Examples

### Track Performance Over Time

```bash
# Establish baseline after initial tasks
npx ts-node src/cli-optimize.ts analyze

# ... execute more tasks ...

# Compare with baseline
npx ts-node src/cli-optimize.ts analyze
```

**Metrics to Track:**
- Success rate trends
- Average execution time
- Error patterns
- Agent performance
- Task completion rates

### Debug Performance Issues

```bash
# Having slow executions?
npx ts-node src/cli-optimize.ts analyze --export > debug.json

# Review the data to identify bottlenecks
cat debug.json | grep "averageTime"
```

## Conclusion

These examples demonstrate how Newma (牛码)'s multi-agent system can handle a wide variety of development tasks. The key is to:

1. **Start simple** - Use single agent for straightforward tasks
2. **Scale up** - Add more agents for complex, multi-faceted requirements
3. **Verify quality** - Use `--verify` flag for critical code
4. **Test thoroughly** - Always include Testing Agent for important features
5. **Document well** - Use Documentation Agent to keep docs in sync
6. **Optimize continuously** - Use Phase 4 self-optimization to improve performance
7. **Go autonomous** - Use autonomous mode for complete, hands-off execution

For more information, see:
- [README.md](./README.md) - Main documentation
- [PHASE3_SUMMARY.md](./PHASE3_SUMMARY.md) - Multi-agent system details
- [PHASE4_SUMMARY.md](./PHASE4_SUMMARY.md) - Self-optimization system details
- [AUTONOMOUS.md](./AUTONOMOUS.md) - Tool calling and autonomous action capabilities
- [CLAUDE.md](./CLAUDE.md) - Developer guide
