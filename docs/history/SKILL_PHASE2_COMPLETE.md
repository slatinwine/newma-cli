# Newma Skill 系统 - Phase 2 完成

**日期**: 2026-02-10
**状态**: ✅ Phase 2 Complete
**灵感来源**: [OpenDeepWiki 的 Agent Skills 机制](https://mp.weixin.qq.com/s/U43xX8T1vKdhqHccL0Qbng)

## 🎉 Phase 2 亮点

### 新增完整技能管理工具链！

现在你可以：
✅ 安装 skills（从 ZIP 或 URL）
✅ 验证 skills（格式检查）
✅ 列出已安装的 skills
✅ 启用/禁用 skills
✅ 搜索 skills（按类型、标签、作者）
✅ 查看技能详情和使用统计
✅ 卸载 skills

## 📦 新增组件（Phase 2）

### 1. Skill Validator (`src/skills/validator.ts`) - 506 行

**功能**: 验证 SKILL.md 格式和结构

**验证项目**:
- ✅ 必填字段检查（name, description, type, triggers）
- ✅ Name 格式验证（kebab-case）
- ✅ Type 验证（knowledge/code/hybrid）
- ✅ Complexity 范围（1-10）
- ✅ allowed-tools 语法验证
- ✅ Version 格式（semver）
- ✅ Timeout 范围（10-600秒）
- ✅ 文件夹结构验证

**使用**:
```bash
npx ts-node bin/newma-skill.ts validate .kode/skills/my-skill
npx ts-node bin/newma-skill.ts validate .kode/skills/my-skill --strict
```

### 2. Skill Installer (`bin/newma-skill-install.ts`) - 302 行

**功能**: 从 ZIP 文件或 URL 安装 skills

**特性**:
- 📥 下载 ZIP（从 URL）
- 📂 自动解压到临时目录
- 🔍 自动查找 SKILL.md
- ✅ 格式验证
- 📝 更新注册表
- ✅ 安装验证

**使用**:
```bash
# 从本地 ZIP 安装
npx ts-node bin/newma-skill-install.ts ./skill.zip

# 从 URL 安装
npx ts-node bin/newma-skill-install.ts https://example.com/skill.zip

# 强制覆盖
npx ts-node bin/newma-skill-install.ts ./skill.zip --force

# 跳过验证
npx ts-node bin/newma-skill-install.ts ./skill.zip --skip-validation
```

### 3. Skill CLI (`bin/newma-skill.ts`) - 426 行

**功能**: 完整的 skill 管理命令行工具

**命令清单**:

#### `list` - 列出 skills
```bash
npx ts-node bin/newma-skill.ts list              # 列出已启用的 skills
npx ts-node bin/newma-skill.ts list --all        # 列出所有 skills
npx ts-node bin/newma-skill.ts list --enabled    # 仅已启用
npx ts-node bin/newma-skill.ts list --disabled   # 仅已禁用
npx ts-node bin/newma-skill.ts list --json       # JSON 输出
npx ts-node bin/newma-skill.ts list --sort usage # 按使用次数排序
```

#### `enable/disable` - 启用/禁用 skill
```bash
npx ts-node bin/newma-skill.ts enable my-skill
npx ts-node bin/newma-skill.ts disable my-skill
```

#### `uninstall` - 卸载 skill
```bash
npx ts-node bin/newma-skill.ts uninstall my-skill
npx ts-node bin/newma-skill.ts uninstall my-skill --force
```

#### `validate` - 验证 skill
```bash
npx ts-node bin/newma-skill.ts validate .kode/skills/my-skill
npx ts-node bin/newma-skill.ts validate .kode/skills/my-skill --strict
```

#### `info` - 显示 skill 详情
```bash
npx ts-node bin/newma-skill.ts info my-skill
```

#### `search` - 搜索 skills
```bash
npx ts-node bin/newma-skill.ts search "code"
npx ts-node bin/newma-skill.ts search "git" --type hybrid
npx ts-node bin/newma-skill.ts search "review" --tag testing
npx ts-node bin/newma-skill.ts search "*" --author "Your Name"
```

#### `stats` - 显示统计
```bash
npx ts-node bin/newma-skill.ts stats
```

## 🔗 集成 Claude Skills

### 从 https://claude-plugins.dev/ 安装

1. **浏览 skills**: 访问 https://claude-plugins.dev/
2. **下载 skill**: 找到想要的 skill，下载 ZIP
3. **安装到 newma**:
   ```bash
   npx ts-node bin/newma-skill-install.ts ./downloaded-skill.zip
   ```

4. **验证安装**:
   ```bash
   npx ts-node bin/newma-skill.ts list
   ```

5. **使用 skill**: AI 会自动发现并使用！

### 示例：安装 frontend-design skill

```bash
# 1. 下载 frontend-design skill
wget https://claude-plugins.dev/skills/frontend-design/download

# 2. 安装
npx ts-node bin/newma-skill-install.ts frontend-design.zip

# 3. 查看
npx ts-node bin/newma-skill.ts info frontend-design

# 4. 使用
npx newma-cli -i
> Create a landing page for a SaaS product
# AI 会自动调用 frontend-design skill！
```

## 📊 完整组件清单

### Phase 1 组件（AI 集成）
| 文件 | 行数 | 状态 |
|------|------|------|
| `src/skills/tool-converter.ts` | 247 | ✅ |
| `src/skills/registry.ts` | 374 | ✅ |
| `src/skills/executor.ts` | 324 | ✅ |
| `src/ai.ts` | 修改 | ✅ |

### Phase 2 组件（管理工具）
| 文件 | 行数 | 状态 |
|------|------|------|
| `src/skills/validator.ts` | 506 | ✅ |
| `bin/newma-skill-install.ts` | 302 | ✅ |
| `bin/newma-skill.ts` | 426 | ✅ |

### 文档
| 文件 | 状态 |
|------|------|
| `SKILL_AI_INTEGRATION.md` | ✅ |
| `SKILL_OPTIMIZATION_SUMMARY.md` | ✅ |
| `SKILL_PHASE2_COMPLETE.md` | ✅ （本文件） |

## 💡 使用技巧

### 1. 批量安装 skills
```bash
# 从 URL 批量安装
for skill in \
  "https://claude-plugins.dev/skills/frontend-design/download" \
  "https://claude-plugins.dev/skills/algorithmic-art/download" \
  "https://claude-plugins.dev/skills/doc-coauthoring/download"
do
  npx ts-node bin/newma-skill-install.ts "$skill"
done
```

### 2. 搜索特定类型的 skills
```bash
# 查找所有 code 类型的 skills
npx ts-node bin/newma-skill.ts search "*" --type code

# 查找特定标签的 skills
npx ts-node bin/newma-skill.ts search "*" --tag testing
```

### 3. 监控 skill 使用情况
```bash
# 查看使用统计
npx ts-node bin/newma-skill.ts stats

# 查看最常用的 skills
npx ts-node bin/newma-skill.ts list --sort usage
```

### 4. 开发和测试 workflow
```bash
# 1. 创建 skill
mkdir -p .kode/skills/my-skill
# 编辑 SKILL.md

# 2. 验证格式
npx ts-node bin/newma-skill.ts validate .kode/skills/my-skill --strict

# 3. 重新加载 skills
npx newma-cli -i
> /reload

# 4. 测试
> Test my skill
```

## 🔍 技术细节

### 验证规则

**Name 格式**:
```regex
^[a-z0-9]+(-[a-z0-9]+)*$
```
- 小写字母、数字、连字符
- 不能以连字符开头/结尾
- 最大 64 字符

**Type**:
- `knowledge` - 知识型（问答、解释）
- `code` - 代码型（生成、修改代码）
- `hybrid` - 混合型

**Version** (semver):
```
MAJOR.MINOR.PATCH
1.0.0 - 正式版本
1.0.0-beta - 预发布版本
1.0.0+build - 构建元数据
```

**allowed-tools**:
```yaml
allowedTools:
  - read_file     # 蛇形命名
  - search_code
  - run_command
```

### 注册表结构

**`.kode/skills/registry.json`**:
```json
{
  "version": "1.0",
  "lastUpdated": "2026-02-10T12:00:00.000Z",
  "skills": {
    "my-skill": {
      "name": "my-skill",
      "version": "1.0.0",
      "description": "My awesome skill",
      "type": "hybrid",
      "enabled": true,
      "usageCount": 5,
      "lastUsedAt": "2026-02-10T12:30:00.000Z",
      "path": ".kode/skills/my-skill",
      ...
    }
  }
}
```

## 🚀 性能优化

### 批量操作
```typescript
// 一次加载多个 skills
const skillManager = new SimpleSkillManager({
  skillDirectories: [
    '.kode/skills',
    '.kode/skills/approved',
    '.kode/skills/memo-master'
  ]
});
await skillManager.discoverSkills();
```

### 缓存策略
```typescript
// 执行器缓存
const executor = new SkillExecutor(skillManager, registry, {
  enableCache: true,
  cacheTTL: 300,  // 5 minutes
});
```

## 🛡️ 错误处理

### 验证错误
```typescript
const result = await validator.validateSkill(path);
if (!result.valid) {
  for (const error of result.errors) {
    console.error(`[${error.field}] ${error.message}`);
  }
}
```

### 安装失败
```bash
# 重试安装
npx ts-node bin/newma-skill-install.ts skill.zip --force

# 跳过验证
npx ts-node bin/newma-skill-install.ts skill.zip --skip-validation
```

## 📈 统计数据示例

```bash
$ npx ts-node bin/newma-skill.ts stats

📊 Skill Statistics

Overview:
  Total: 15
  Enabled: 12
  Disabled: 3

By Type:
  knowledge: 8
  code: 4
  hybrid: 3

By Source:
  local: 10
  remote: 3
  precipitation: 2

Usage:
  Total executions: 156
```

## 🎯 最佳实践

### 1. Skill 命名
- ✅ `code-review`
- ✅ `git-expert`
- ✅ `api-integration`
- ❌ `CodeReview` (驼峰)
- ❌ `code_review` (下划线)
- ❌ `code-review-` (结尾连字符)

### 2. 编写好的描述
```yaml
description: |
  Expert code reviewer with focus on:
  - Security vulnerabilities
  - Performance issues
  - Code style consistency

  When to use: Code review, PR analysis, quality checks
```

### 3. 定义有意义的 triggers
```yaml
triggers:
  - code review
  - check code
  - PR review
  - analyze code
```

### 4. 使用 allowed-tools
```yaml
allowedTools:
  - read_file
  - search_code
  # 仅声明需要的工具，最小化权限
```

## 🔄 迁移指南

### 从旧系统迁移

如果你有旧版本的 skills：

1. **备份**:
   ```bash
   cp -r .kode/skills .kode/skills.backup
   ```

2. **验证**:
   ```bash
   for dir in .kode/skills/*/; do
     npx ts-node bin/newma-skill.ts validate "$dir"
   done
   ```

3. **修复**:
   - 修正 name 格式
   - 添加缺失字段
   - 修复 triggers

4. **重新加载**:
   ```bash
   npx newma-cli -i
   > /reload
   ```

## 🐛 已知问题

### Phase 2 限制
- ⚠️ uninstall 不删除文件（仅从注册表移除）
- ⚠️ 没有 skill 依赖管理
- ⚠️ 没有自动更新机制

### 计划改进
- 🔜 文件自动删除（uninstall）
- 🔜 Skill 版本升级
- 🔜 依赖解析和安装

## 🔗 相关资源

### 官方资源
- **Claude Skills**: https://claude-plugins.dev/
- **Anthropic Agent Skills**: https://agentskills.io
- **OpenDeepWiki**: [原文链接](https://mp.weixin.qq.com/s/U43xX8T1vKdhqHccL0Qbng)

### Newma 文档
- [SKILL_AI_INTEGRATION.md](./SKILL_AI_INTEGRATION.md) - AI 集成指南
- [SKILL_OPTIMIZATION_SUMMARY.md](./SKILL_OPTIMIZATION_SUMMARY.md) - Phase 1 总结
- [CLAUDE.md](./CLAUDE.md) - 项目总览

## 🙏 致谢

- **灵感来源**: tokengo 的 OpenDeepWiki 文章
- **设计参考**: Anthropic 的 Agent Skills 规范
- **实现团队**: Newma (牛码) 开发团队
- **社区贡献**: Claude Skills 生态

---

## 📝 快速开始指南

### 安装第一个 skill

```bash
# 1. 安装
npx ts-node bin/newma-skill-install.ts ./skill.zip

# 2. 验证
npx ts-node bin/newma-skill.ts list

# 3. 使用
npx newma-cli -i
> 你的问题
# AI 会自动选择并执行合适的 skill！
```

**就这么简单！** 🎉

---

**总结**: Phase 2 完成了完整的 skill 管理工具链。从安装到验证、从搜索到统计，现在你有了专业级的 skill 管理能力。结合 Phase 1 的 AI 集成，newma 的 skill 系统已经达到生产就绪状态。
