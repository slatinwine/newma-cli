# Web Mode 使用指南

## 启动 Web 服务器

```bash
# 默认配置 (localhost:3000)
npx newma-cli --web

# 自定义端口和主机
npx newma-cli --web --web-port 8080 --web-host 127.0.0.1

# 指定项目目录
npx newma-cli --web --dir /path/to/project

# 启用调试模式
DEBUG=1 npx newma-cli --web
```

## API 端点

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

**响应**:
```json
{
  "status": "ok",
  "type": "newma-web",
  "timestamp": 1234567890123
}
```

### 2. 执行任务

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "创建一个测试文件 test.txt",
    "mode": "chat"
  }'
```

**参数**:
- `requirement` (必需): 任务描述
- `mode` (可选): 执行模式
  - `chat`: 聊天模式（默认）
  - `plan`: 规划模式
  - `execute`: 执行模式
  - `verify`: 验证模式
  - `loop`: 循环模式

**响应**:
```json
{
  "status": "received",
  "requirement": "创建一个测试文件 test.txt",
  "mode": "chat",
  "timestamp": 1234567890123
}
```

### 3. 获取状态

```bash
curl http://localhost:3000/api/status
```

**响应**:
```json
{
  "status": "running",
  "type": "newma-web",
  "outputBuffer": [...],
  "timestamp": 1234567890123
}
```

### 4. 清空输出

```bash
curl -X POST http://localhost:3000/api/clear
```

### 5. 停止服务器

```bash
curl -X POST http://localhost:3000/api/stop
```

## 使用示例

### 示例 1: 简单聊天

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"requirement":"你好，请介绍一下你自己"}'
```

### 示例 2: 执行规划

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "添加用户认证功能",
    "mode": "plan"
  }'
```

### 示例 3: 完整循环

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "创建 REST API",
    "mode": "loop"
  }'
```

## Python 集成示例

```python
import requests
import json

class NewmaWebClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url

    def execute(self, requirement, mode="chat"):
        """执行任务"""
        response = requests.post(
            f"{self.base_url}/api/execute",
            json={
                "requirement": requirement,
                "mode": mode
            }
        )
        return response.json()

    def get_status(self):
        """获取状态"""
        response = requests.get(f"{self.base_url}/api/status")
        return response.json()

    def health(self):
        """健康检查"""
        response = requests.get(f"{self.base_url}/health")
        return response.json()

# 使用示例
client = NewmaWebClient()

# 执行任务
result = client.execute("创建一个测试文件")
print(result)

# 检查状态
status = client.get_status()
print(status)
```

## Node.js 集成示例

```javascript
const axios = require('axios');

class NewmaWebClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async execute(requirement, mode = 'chat') {
    const response = await axios.post(`${this.baseUrl}/api/execute`, {
      requirement,
      mode
    });
    return response.data;
  }

  async getStatus() {
    const response = await axios.get(`${this.baseUrl}/api/status`);
    return response.data;
  }

  async health() {
    const response = await axios.get(`${this.baseUrl}/health`);
    return response.data;
  }
}

// 使用示例
(async () => {
  const client = new NewmaWebClient();

  // 执行任务
  const result = await client.execute('创建一个测试文件');
  console.log(result);

  // 检查状态
  const status = await client.getStatus();
  console.log(status);
})();
```

## 注意事项

1. **不使用思维树**: Web 模式默认不使用 ToT（Tree of Thoughts）等复杂规划算法，直接执行任务以提高响应速度

2. **长时间运行**: 服务器会持续运行直到手动停止（Ctrl+C 或 `/api/stop`）

3. **输出缓冲**: 所有输出都会存储在缓冲区中，可以通过 `/api/status` 获取

4. **并发请求**: 当前实现是单线程处理，多个任务会按顺序执行

5. **超时设置**: 默认输入超时为 5 分钟，可以通过修改 WebFrontend 代码调整

## 与其他模式的区别

| 特性 | Web 模式 | 交互模式 (-i) | 自主模式 (--autonomous) |
|------|---------|--------------|----------------------|
| 接口 | HTTP API | 命令行 REPL | 命令行参数 |
| 思维树 | ❌ 不使用 | ✅ 可选 | ✅ 使用 |
| 长时间运行 | ✅ 是 | ✅ 是 | ❌ 否（执行完退出） |
| 外部调用 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| 适用场景 | API 集成、自动化 | 交互式开发 | 批量任务执行 |

## 故障排除

### 端口被占用

```bash
# 使用不同端口
npx newma-cli --web --web-port 3001
```

### 无法连接

1. 检查防火墙设置
2. 确认服务器正在运行
3. 检查端口是否正确

### 查看详细日志

```bash
DEBUG=1 npx newma-cli --web
```
