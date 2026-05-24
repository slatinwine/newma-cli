# Skill-Creator 改进计划

## 📊 当前状态分析

### 现有架构（Phase 1-3）
```
需求 → Skill-Creator → AI 生成 → 验证 → 用户预览 → 插件代码
         ↓
    Phase 1: 'plan' 模式 + 验证
    Phase 2: Function Calling API
    Phase 3: 交互式预览
```

### 核心问题（从 Calculator Plugin 手动修复中发现）

#### 问题 1: 类型系统不匹配 ❌
**现象**: AI 生成的代码使用了错误的类型值

```typescript
// AI 生成（错误）:
category: 'utility',           // ❌ 应该是 ToolCategory.ANALYSIS
permissions: ['read_only'],    // ❌ 应该是 Permission[] 或空数组
handler: async (params: { a: number; b: number }, context) => { ... }

// 正确写法:
import { ToolCategory, Permission } from '../../src/tools/types';

category: ToolCategory.ANALYSIS,  // ✅
permissions: [],                   // ✅
handler: async (params, context) => {  // ✅
  const { a, b } = params as { a: number; b: number };
  // ...
},
```

**根本原因**:
- Prompt 没有明确要求使用枚举
- 没有提供完整的示例代码
- 验证逻辑只检查字符串，不检查类型

---

#### 问题 2: ToolParameter 数组缺失 ❌
**现象**: AI 生成的工具没有 `parameters` 字段

```typescript
// AI 生成（错误）:
{
  name: 'add',
  description: 'Add two numbers',
  category: ToolCategory.ANALYSIS,
  permissions: [],
  // ❌ 缺少 parameters 字段！
  handler: async (params, context) => { ... }
}

// 正确写法:
{
  name: 'add',
  description: 'Add two numbers',
  category: ToolCategory.ANALYSIS,
  permissions: [],
  parameters: [  // ✅ 必需字段
    {
      name: 'a',
      type: 'number',
      description: 'First number',
      required: true,
    },
    {
      name: 'b',
      type: 'number',
      description: 'Second number',
      required: true,
    },
  ],
  handler: async (params, context) => { ... }
}
```

---

#### 问题 3: 验证逻辑不够严格 ⚠️
**现状**: `validateGeneratedCode()` 只做 7 个基础检查

```typescript
// 当前检查:
1. 必须以 import/interface/type/const/export 开头
2. 不能包含编号列表（AI 思考痕迹）
3. 不能包含 JSON 元数据
4. 必须有 export 语句
5. 必须引用 Plugin 接口
6. 最小长度 500 字符
7. 不能包含 markdown 代码块标记
```

**缺失的检查**:
- ❌ 没有检查 ToolCategory 枚举使用
- ❌ 没有检查 Permission 枚举使用
- ❌ 没有检查 parameters 字段存在性
- ❌ 没有检查 handler 函数签名
- ❌ 没有 TypeScript 编译验证

---

#### 问题 4: 缺少编译验证 🚨
**现状**: 生成的代码不经过 TypeScript 编译器验证

```typescript
// 当前流程:
AI 生成 → 文本验证 → 写入文件
         ↑
    只检查基本格式

// 应该有:
AI 生成 → 文本验证 → TypeScript 编译 → 测试运行 → 写入文件
                     ↑              ↑
                类型检查         功能验证
```

---

## 🎯 改进方案（4 个阶段）

---

## 第 1 阶段: 增强 Prompt（立即见效）⚡

### 改进 1.1: 添加完整示例代码
**目标**: 让 AI 有正确的参考模板

```typescript
// src/skills-creator/prompts/plugin-prompt.ts (新文件)

export const PLUGIN_CODE_EXAMPLE = `
/**
 * Calculator Plugin - 完整示例
 */
import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';

const calculatorPlugin: Plugin = {
  id: 'calculator-plugin',
  name: 'Calculator Plugin',
  version: '1.0.0',
  description: 'A calculator plugin with basic math operations',

  tools: [
    {
      name: 'add',
      description: 'Add two numbers together',
      category: ToolCategory.ANALYSIS,
      permissions: [],
      parameters: [
        {
          name: 'a',
          type: 'number',
          description: 'First number',
          required: true,
        },
        {
          name: 'b',
          type: 'number',
          description: 'Second number',
          required: true,
        },
      ],
      handler: async (params, context) => {
        const { a, b } = params as { a: number; b: number };

        if (typeof a !== 'number' || typeof b !== 'number') {
          return {
            success: false,
            error: 'Both a and b must be numbers',
          };
        }

        const result = a + b;

        return {
          success: true,
          output: \`\${a} + \${b} = \${result}\`,
        };
      },
    },
  ],

  async initialize(context) {
    console.log('[Calculator Plugin] ✅ Initialized');
  },

  async cleanup(context) {
    console.log('[Calculator Plugin] 🧹 Cleaned up');
  },
};

export default calculatorPlugin;
`;
```

**预期效果**:
- 类型匹配准确率: 60% → 95%
- ToolParameter 缺失率: 80% → 5%

---

### 改进 1.2: 验证增强
**目标**: 在写文件前捕获类型错误

```typescript
// src/skills-creator/validator.ts (新文件)

export class PluginCodeValidator {
  validate(code: string): ValidationResult {
    const errors: string[] = [];
    const fixes: string[] = [];

    // 检查 ToolCategory 枚举使用
    const hasStringCategory = /category:\s*['"](file|command|utility|analysis|system)['"]/i.test(code);
    if (hasStringCategory) {
      errors.push('category must use ToolCategory enum, not strings');
      fixes.push("Replace category: 'utility' with category: ToolCategory.ANALYSIS");
    }

    // 检查 Permission 枚举使用
    const hasStringPermissions = /permissions:\s*\[(['"](read_files|write_files|delete_files|run_commands)['"],?\s*)+\]/i.test(code);
    if (hasStringPermissions) {
      errors.push('permissions must use Permission enum or empty array, not strings');
    }

    // 检查 parameters 字段
    const toolsWithoutParams = this.findToolsMissingParameters(code);
    if (toolsWithoutParams.length > 0) {
      errors.push(`Tools missing parameters: ${toolsWithoutParams.join(', ')}`);
    }

    return { valid: errors.length === 0, errors, warnings: [], fixes };
  }

  autoFix(code: string): string {
    let fixed = code;

    // 自动替换常见错误
    fixed = fixed.replace(/category:\s*['"]utility['"]/gi, 'category: ToolCategory.ANALYSIS');
    fixed = fixed.replace(/permissions:\s*\[\s*['"]read_only['"]\s*\]/gi, 'permissions: []');

    return fixed;
  }
}
```

**预期效果**:
- 捕获类型错误率: 0% → 90%
- 自动修复成功率: 60-70%

---

## 第 2 阶段: TypeScript 编译验证（可靠性）🔒

### 改进 2.1: 集成 TypeScript 编译器
**目标**: 确保生成的代码能通过编译

```typescript
// src/skills-creator/compiler.ts (新文件)

import * as ts from 'typescript';

export class TypeScriptCompiler {
  async compile(code: string): Promise<CompilationResult> {
    const tempDir = await createTempDir();
    const tempFile = path.join(tempDir, 'plugin.ts');

    try {
      await fs.writeFile(tempFile, code);

      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        skipLibCheck: true,
      };

      const program = ts.createProgram([tempFile], compilerOptions);
      const diagnostics = ts.getPreEmitDiagnostics(program);

      const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);

      return {
        success: errors.length === 0,
        errors,
        warnings: diagnostics.filter(d => d.category === ts.DiagnosticCategory.Warning),
      };

    } finally {
      await cleanup(tempDir);
    }
  }
}
```

**预期效果**:
- 编译错误捕获率: 100%
- 类型安全保证: 100%

---

## 📊 实施计划与预期效果

### 时间线

| 阶段 | 时间 | 工作量 | 优先级 |
|------|------|--------|--------|
| 第 1 阶段: 增强 Prompt | 1-2 天 | 中 | 🔴 高 |
| 第 2 阶段: 编译验证 | 2-3 天 | 高 | 🔴 高 |
| 第 3 阶段: 模板系统 | 3-5 天 | 高 | 🟡 中 |

### 预期改进指标

| 指标 | 当前 | 第 1 阶段 | 第 2 阶段 | 第 3 阶段 |
|------|------|----------|----------|----------|
| **类型匹配准确率** | 60% | 95% | 99% | 99%+ |
| **编译成功率** | 40% | 70% | 100% | 100% |
| **测试通过率** | 30% | 50% | 80% | 95% |
| **需要手动修复** | 80% | 30% | 5% | 1% |

---

## 🎯 立即可实施的改进（今天就做）

### 最小可行改进（1-2 小时）

1. **添加完整示例到 Prompt**（30 分钟）
   - 复制 Calculator Plugin 代码作为示例
   - 更新 `buildCodeGenerationPrompt()` 方法

2. **增强验证逻辑**（1 小时）
   - 创建 `validator.ts`
   - 添加类型检查
   - 实现自动修复

3. **测试验证**（30 分钟）
   - 生成 Calculator Plugin
   - 验证类型匹配
   - 确认编译通过

---

**建议下一步**: 从**第 1 阶段（增强 Prompt）**开始，因为：
- ⚡ 实施最快（1-2 天）
- 🎯 立竿见影（准确率 60% → 95%）
- 🔧 风险最低（不影响现有功能）

要开始实施吗？
