import { ServiceManager, ServiceStatus, ServiceConfig, ServiceTimeoutError } from './types';
import { logger } from '../logger';

/**
 * Base service manager implementation providing common functionality
 */
export abstract class BaseServiceManager implements ServiceManager {
  protected status: ServiceStatus = {
    running: false,
    state: 'stopped'
  };

  constructor(protected config: ServiceConfig) {}

  abstract startService(): Promise<void>;
  abstract stopService(): Promise<void>;

  /**
   * Check if the service is healthy by attempting to connect
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${this.config.port}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current service status
   */
  async getStatus(): Promise<ServiceStatus> {
    // Update running state based on health check
    this.status.running = await this.checkHealth();
    this.status.state = this.status.running ? 'running' : 'stopped';
    return { ...this.status };
  }

  /**
   * Wait for service to become healthy
   */
  async waitForHealth(
    timeout: number = this.config.healthCheck.timeout,
    interval: number = this.config.healthCheck.interval
  ): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await this.checkHealth()) {
        this.status.state = 'running';
        this.status.running = true;
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      logger.debug(`Waiting for service to be healthy... (${Date.now() - start}ms)`);
    }

    throw new ServiceTimeoutError(
      'health',
      timeout,
      await this.getStatus()
    );
  }

  /**
   * Update service status
   */
  protected updateStatus(update: Partial<ServiceStatus>) {
    this.status = {
      ...this.status,
      ...update
    };
  }

  /**
   * Log status change
   */
  protected logStatusChange(operation: string, error?: Error) {
    if (error) {
      logger.error(`Service ${operation} failed:`, error);
    } else {
      logger.info(`Service ${operation} completed. Status: ${this.status.state}`);
    }
  }
}
