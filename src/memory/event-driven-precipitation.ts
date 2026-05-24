/**
 * Event-Driven Precipitation Integration
 *
 * 将沉淀系统与事件循环集成
 */

import { PrecipitationCoordinator } from './precipitation-coordinator';

// ============================================================================
// 沉淀事件类型
// ============================================================================

/**
 * 沉淀事件类型
 */
export enum PrecipitationEventType {
  /** 沉淀开始 */
  PRECIPITATION_STARTED = 'precipitation.started',
  /** 沉淀完成 */
  PRECIPITATION_COMPLETED = 'precipitation.completed',
  /** 沉淀失败 */
  PRECIPITATION_FAILED = 'precipitation.failed',
}

// ============================================================================
// 事件监听器类型
// ============================================================================

/**
 * 沉淀事件监听器
 */
export type PrecipitationEventListener = (
  type: PrecipitationEventType,
  data: any
) => void | Promise<void>;

// ============================================================================
// 事件适配器
// ============================================================================

/**
 * 沉淀事件适配器
 *
 * 监听沉淀系统事件并通知注册的监听器
 */
export class PrecipitationEventAdapter {
  private coordinator: PrecipitationCoordinator;
  private listeners: Map<PrecipitationEventType, PrecipitationEventListener[]> = new Map();

  constructor(coordinator: PrecipitationCoordinator) {
    this.coordinator = coordinator;
  }

  /**
   * 添加事件监听器
   */
  on(type: PrecipitationEventType, listener: PrecipitationEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  off(type: PrecipitationEventType, listener: PrecipitationEventListener): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发布事件到所有监听器
   */
  private async emit(type: PrecipitationEventType, data: any): Promise<void> {
    const listeners = this.listeners.get(type) || [];
    for (const listener of listeners) {
      try {
        await listener(type, data);
      } catch (error) {
        console.error(`[PrecipitationEventAdapter] Listener error for ${type}:`, error);
      }
    }
  }

  /**
   * 启动事件监听
   */
  async startEventListener(): Promise<void> {
    console.log('[PrecipitationEventAdapter] Starting event listener...');

    // 包装沉淀回调
    const precipitationCallback = async () => {
      await this.emit(PrecipitationEventType.PRECIPITATION_STARTED, {
        timestamp: Date.now(),
      });

      try {
        const result = await this.coordinator.trigger();

        await this.emit(PrecipitationEventType.PRECIPITATION_COMPLETED, {
          timestamp: Date.now(),
          result,
        });
      } catch (error: any) {
        await this.emit(PrecipitationEventType.PRECIPITATION_FAILED, {
          timestamp: Date.now(),
          error: error.message,
        });
      }
    };

    // 启动协调器（使用包装后的回调）
    await this.coordinator.start(precipitationCallback);

    console.log('[PrecipitationEventAdapter] Event listener started');
  }

  /**
   * 停止事件监听
   */
  async stopEventListener(): Promise<void> {
    console.log('[PrecipitationEventAdapter] Stopping event listener...');
    await this.coordinator.stop();
    console.log('[PrecipitationEventAdapter] Event listener stopped');
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建事件驱动的沉淀系统
 *
 * @param coordinator 沉淀协调器
 * @returns 事件适配器
 */
export function createEventDrivenPrecipitation(
  coordinator: PrecipitationCoordinator
): PrecipitationEventAdapter {
  return new PrecipitationEventAdapter(coordinator);
}
