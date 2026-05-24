// src/http-agent.ts
/**
 * HTTP 连接池管理
 * 复用 HTTP 连接，减少连接建立时间
 */

import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import chalk from 'chalk';

/**
 * 全局 HTTPS Agent（连接池）
 */
export const httpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

/**
 * 全局 HTTP Agent（连接池）
 */
export const httpAgent = new HttpAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

/**
 * 获取适当的 Agent
 */
export function getAgent(url: string): typeof httpsAgent | typeof httpAgent {
  return url.startsWith('https') ? httpsAgent : httpAgent;
}

/**
 * 连接池统计信息
 */
export function getConnectionPoolStats() {
  return {
    https: {
      totalSockets: httpsAgent.maxSockets,
      freeSockets: httpsAgent.maxFreeSockets,
    },
    http: {
      totalSockets: httpAgent.maxSockets,
      freeSockets: httpAgent.maxFreeSockets,
    },
  };
}

/**
 * 打印连接池统计
 */
export function logConnectionPoolStats() {
  const stats = getConnectionPoolStats();
  console.log(chalk.gray('📊 Connection Pool Stats:'));
  console.log(chalk.gray(`   HTTPS: max ${stats.https.totalSockets} sockets, ${stats.https.freeSockets} free`));
  console.log(chalk.gray(`   HTTP:  max ${stats.http.totalSockets} sockets, ${stats.http.freeSockets} free`));
}
