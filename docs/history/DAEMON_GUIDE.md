# Newma 沉淀系统 - 后台运行指南

## 🤔 问题：REPL 关闭后沉淀系统会停止吗？

**答案**：是的，当前实现中，**REPL 关闭后沉淀系统也会停止**。

### 原因

```typescript
// 当前实现：沉淀系统是 REPL 的一部分
class REPLManager {
  private initializePrecipitationSystem() {
    this.precipitationCoordinator = new PrecipitationCoordinator(...);
    this.precipitationCoordinator.start();
  }
}

// 问题：REPL 退出时，整个进程终止，调度器停止
```

**node-schedule 特性**：
- ✅ 进程运行时 → 定时任务工作
- ❌ 进程退出后 → **所有定时任务停止**

---

## ✅ 解决方案

### **方案 1: 守护进程模式**（推荐）

**优点**：
- ✅ 独立运行，不依赖 REPL
- ✅ 可以一直运行
- ✅ 资源占用小

**使用方法**：

```bash
# 1. 开发模式（使用 ts-node）
npm run daemon

# 2. 生产模式（先编译）
npm run build
npm run daemon:prod

# 3. 后台运行（Linux/macOS）
nohup npm run daemon:prod > daemon.log 2>&1 &

# 4. 后台运行（Windows）
start /B npm run daemon:prod > daemon.log 2>&1
```

**输出示例**：
```
🚀 Starting Newma Daemon...

✅ Newma Daemon started successfully!

📅 Schedule: 0 2 * * *
📂 Project: /Users/mac/kode

⚙️  System Status:
   Status: 🟢 Running
   Next run: Tue Feb 03 2026 02:00:00 GMT+0800 (中国标准时间)

💡 Press Ctrl+C to stop
```

**停止守护进程**：
```bash
# 前台运行：按 Ctrl+C
# 后台运行：查找进程并 kill
ps aux | grep "node.*daemon"
kill <PID>
```

---

### **方案 2: 使用 PM2**（生产环境推荐）

**优点**：
- ✅ 自动重启
- ✅ 日志管理
- ✅ 监控功能
- ✅ 开机自启

**安装 PM2**：
```bash
npm install -g pm2
```

**创建 ecosystem.config.js**：
```javascript
module.exports = {
  apps: [{
    name: 'newma-daemon',
    script: './dist/daemon.js',
    cwd: '/Users/mac/kode',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    },
    error_file: './logs/daemon-error.log',
    out_file: './logs/daemon-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
```

**使用 PM2**：
```bash
# 编译
npm run build

# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs newma-daemon

# 停止
pm2 stop newma-daemon

# 重启
pm2 restart newma-daemon

# 删除
pm2 delete newma-daemon

# 开机自启
pm2 startup
pm2 save
```

---

### **方案 3: 系统 Cron Job**（最轻量）

**优点**：
- ✅ 不需要持续运行进程
- ✅ 系统级管理
- ✅ 零资源占用（空闲时）

**创建触发脚本** `scripts/trigger-precipitation.sh`：
```bash
#!/bin/bash

# 切换到项目目录
cd /Users/mac/kode

# 触发沉淀
npx newma-cli --precipitate

# 或者直接运行协调器
node -e "
const { PrecipitationCoordinator } = require('./dist/memory/precipitation-coordinator');
const { getPrecipitationConfig } = require('./dist/config');

const coordinator = new PrecipitationCoordinator(
  { projectRoot: process.cwd(), precipitationConfig: getPrecipitationConfig() },
  { apiKey: process.env.OPENAI_API_KEY }
);

coordinator.trigger().then(result => {
  console.log('✅ Precipitation completed:', result);
  process.exit(0);
}).catch(error => {
  console.error('❌ Precipitation failed:', error);
  process.exit(1);
});
"
```

**添加到 crontab**：
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 2 点执行）
0 2 * * * /Users/mac/kode/scripts/trigger-precipitation.sh >> /Users/mac/kode/logs/precipitation.log 2>&1
```

**查看 cron 任务**：
```bash
# 列出当前用户的 cron 任务
crontab -l

# 编辑 cron 任务
crontab -e

# 删除 cron 任务
crontab -r
```

---

### **方案 4: Docker 容器**（容器化部署）

**创建 Dockerfile**：
```dockerfile
FROM node:22-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制编译后的文件
COPY dist/ ./dist/

# 设置环境变量
ENV OPENAI_API_KEY=""
ENV NODE_ENV=production

# 运行守护进程
CMD ["node", "dist/daemon.js"]
```

**构建和运行**：
```bash
# 构建镜像
docker build -t newma-daemon .

# 运行容器
docker run -d \
  --name newma-daemon \
  -e OPENAI_API_KEY=your-key-here \
  -v /path/to/kode:/app \
  newma-daemon

# 查看日志
docker logs -f newma-daemon

# 停止容器
docker stop newma-daemon
```

---

## 📊 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **守护进程** | 简单直接 | 无自动重启 | 开发测试 |
| **PM2** | 自动重启、监控 | 需要 PM2 | **生产环境推荐** |
| **Cron Job** | 最轻量 | 灵活性差 | 服务器环境 |
| **Docker** | 容器化、可移植 | 需要 Docker | 容器化部署 |

---

## 🎯 推荐配置

### **开发环境**：守护进程

```bash
npm run daemon
```

### **生产环境**：PM2

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### **服务器环境**：Cron Job

```bash
crontab -e
# 添加：0 2 * * * /path/to/trigger-precipitation.sh
```

---

## 🧪 测试守护进程

```bash
# 1. 编译
npm run build

# 2. 启动守护进程（前台测试）
npm run daemon:prod

# 3. 等待几秒，查看输出
# 应该看到：
# ✅ Newma Daemon started successfully!
# ⚙️  System Status: 🟢 Running

# 4. 按 Ctrl+C 停止
```

---

## 🔧 故障排查

### **守护进程无法启动**

```bash
# 检查 OPENAI_API_KEY
echo $OPENAI_API_KEY

# 确保已设置
export OPENAI_API_KEY=your-key-here
```

### **PM2 无法启动**

```bash
# 检查日志
pm2 logs newma-daemon --lines 50

# 重新启动
pm2 restart newma-daemon
```

### **Cron 任务不执行**

```bash
# 检查 cron 服务
# macOS
sudo launchctl list | grep cron
# Linux
sudo systemctl status cron

# 查看 cron 日志
grep CRON /var/log/syslog
```

---

## 📝 总结

**✅ 推荐做法**：
1. **开发/测试**：使用 `npm run daemon`（前台运行）
2. **个人项目**：使用 PM2（后台运行，自动重启）
3. **团队项目/服务器**：使用 PM2 或 Docker
4. **最省资源**：使用系统 Cron Job

**⚠️ 注意**：
- 守护进程需要一直运行才能按时执行沉淀
- 如果不需要实时性，Cron Job 是最经济的选择
- 生产环境建议使用 PM2 或 Docker 以获得更好的管理能力

---

**下一步**：选择适合你的方案，开始让沉淀系统在后台工作！🚀
