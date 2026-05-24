# ThinkFront Skill - 演示文档

## ✅ Skill 创建成功

ThinkFront skill 已经成功创建并测试通过！

### 📊 技能信息

- **名称**: ThinkFront
- **类型**: Knowledge (知识型)
- **描述**: 极简主义前端设计指导系统 - 突破常规，拒绝平庸
- **位置**: `.kode/skills/thinkfront/SKILL.md`

### 🎯 核心特性

1. **极简设计原则**
   - 留白即力量
   - 移除一切非必要元素
   - 每个像素都有意义

2. **严格禁止紫色**
   - ❌ #800080, #9B59B6, #6A5ACD 等所有紫色系
   - ✅ 提供 4 套替代配色方案

3. **突破常规设计**
   - 拒绝 Bootstrap 默认样式
   - 反对 12 列网格
   - 避免 Hero 居中模板
   - 鼓励不对称布局

4. **创意字体**
   - 避免使用 Inter、Roboto
   - 推荐 IBM Plex Sans、Space Grotesk 等

### 🎨 触发词

```
design, frontend, UI, interface, component, layout, color, style
create a page, build a website
```

### 📝 测试结果

#### Python 执行器测试

```bash
# 发现技能
$ python3 python/execute_skill.py discover .kode/skills
Found 4 skills:
  - ThinkFront: 极简主义前端设计指导系统 - 突破常规，拒绝平庸
  ...

# 匹配测试
$ python3 python/execute_skill.py match "Design a landing page"
{"matched": true, "skill": "ThinkFront", ...}

$ python3 python/execute_skill.py match "Design the layout for my website"
{"matched": true, "skill": "ThinkFront", ...}
```

#### TypeScript 加载器测试

```bash
$ npx ts-node -e "
import { SimpleSkillManager } from './src/skills/simple-loader';

const manager = new SimpleSkillManager();
await manager.discoverSkills();

const thinkfront = manager.getSkill('ThinkFront');
console.log('✅ ThinkFront skill found');
console.log('Triggers:', thinkfront.metadata.triggers);
"
✅ ThinkFront skill found
Triggers: [ 'design', 'frontend', 'UI', ... ]
```

## 🚀 使用示例

### 示例 1：设计登录页

**用户输入**:
```
Design a minimalist login page
```

**AI 响应**（受 ThinkFront 指导）:

```css
/* 极简登录页 - ThinkFront 风格 */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FAFAFA;  /* 纯白背景 */
}

.login-title {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 48px;
  text-align: center;
}

/* 不用紫色渐变，不用圆角卡片，直接极简 */
```

**ThinkFront 原则遵循**:
- ✅ 纯白背景
- ✅ 紧凑字间距
- ✅ 大量留白
- ✅ 无装饰元素

### 示例 2：配色方案

**用户输入**:
```
What color scheme should I use for my dashboard?
```

**AI 响应**（受 ThinkFront 指导）:

根据 ThinkFront 原则，推荐以下方案：

**方案 A：工业风**
```
主色：#37474F (蓝灰)
辅色：#ECEFF1 (浅蓝灰)
强调：#FF6B35 (工业橙)
```

**方案 B：冷调极简**
```
主色：#1A1A1A (接近黑)
辅色：#F5F5F5 (极浅灰)
强调：#00D4AA (青绿)
```

❌ **避免使用紫色** - ThinkFront 严格禁止紫色系

### 示例 3：突破常规布局

**用户输入**:
```
Create a product showcase layout that's not boring
```

**AI 响应**（受 ThinkFront 指导）:

根据 ThinkFront 突破常规原则，推荐：

**不对称分割布局**：
```
┌──────────────┬─────────────┐
│              │             │
│   [大图]     │  [内容]     │
│   66% 宽度   │  34% 宽度   │
│   视觉冲击   │  精简文字   │
│              │             │
└──────────────┴─────────────┘
```

**特点**:
- ✅ 打破传统的 12 列网格
- ✅ 不对称比例 (2:1)
- ✅ 大胆视觉对比
- ❌ 不是 Bootstrap 默认样式

## 🎨 设计系统速查

### 颜色方案

| 方案 | 主色 | 辅色 | 强调色 |
|------|------|------|--------|
| 单色极简 | #000000 | #FFFFFF | #FF3B30 |
| 大地色系 | #2C3E50 | #ECF0F1 | #E67E22 |
| 冷调极简 | #1A1A1A | #F5F5F5 | #00D4AA |
| 工业风 | #37474F | #ECEFF1 | #FF6B35 |

### 字体推荐

| 用途 | 推荐字体 | 避免 |
|------|----------|------|
| 标题 | Space Grotesk, Syne | Inter |
| 正文 | DM Sans, IBM Plex Sans | Roboto |
| 艺术字 | Outfit | Open Sans |

### 间距系统

```
4px  - 微小间距
8px  - 小间距
16px - 常规间距
24px - 中等间距
32px - 大间距
48px - 超大间距
64px - 极大间距
```

## 📋 设计检查清单

设计前端页面时，确保：

- [ ] 没有使用紫色
- [ ] 使用留白，不害怕空白
- [ ] 打破常规布局
- [ ] 只使用 1-2 种强调色
- [ ] 字体不是 Inter/Roboto
- [ ] 去除所有非必要元素
- [ ] 移动端优先设计
- [ ] 动画简单快速
- [ ] 内容自解释

## 🧪 更多测试

### 测试命令

```bash
# 发现 thinkfront skill
python3 python/execute_skill.py discover .kode/skills

# 测试匹配
python3 python/execute_skill.py match "Design a minimalist UI"
python3 python/execute_skill.py match "Create a frontend layout"
python3 python/execute_skill.py match "What colors for my app?"

# TypeScript 测试
npx ts-node -e "
import { SimpleSkillManager } from './src/skills/simple-loader';
const manager = new SimpleSkillManager();
await manager.discoverSkills();
console.log(manager.getSkill('ThinkFront')?.metadata);
"
```

## 🎯 核心价值

ThinkFront skill 的独特价值：

1. **强制极简** - 通过明确的规则约束设计
2. **禁止紫色** - 避免常见的设计雷区
3. **鼓励创意** - 提供突破常规的具体方法
4. **实践导向** - 包含大量代码示例和模板
5. **检查清单** - 确保设计符合原则

## 📚 相关文档

- **SKILL.md** - 完整设计指导 (`.kode/skills/thinkfront/SKILL.md`)
- **SIMPLIFIED_SKILL_SYSTEM.md** - Skill 系统文档
- **SKILL_SYSTEM_TEST_RESULTS.md** - 测试结果报告

---

**状态**: ✅ ThinkFront skill 已创建并测试通过

**位置**: `.kode/skills/thinkfront/`

**可用性**: 立即可用
