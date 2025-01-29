import { ServiceManager, ServiceStatus, ServiceConfig } from './types';
import { HealthChecker, createHealthChecker, waitForHealth } from './health';
import { ServiceError } from './errors';

import Debug from 'debug-level';
const logger = new Debug('base');

/**
 * Base service manager implementation providing common functionality
 */
export abstract class BaseServiceManager implements ServiceManager {
  protected status: ServiceStatus = {
    running: false,
    state: 'stopped'
  };

  protected healthChecker: HealthChecker;

  constructor(protected config: ServiceConfig) {
    this.healthChecker = createHealthChecker(config.port);
  }

  abstract startService(): Promise<void>;
  abstract stopService(): Promise<void>;

  /**
   * Check if the service is healthy
   */
  async checkHealth(): Promise<boolean> {
    return this.healthChecker.check();
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
    checker: HealthChecker = this.healthChecker
  ): Promise<void> {
    await waitForHealth(
      checker,
      {
        timeout: this.config.healthCheck.timeout,
        interval: this.config.healthCheck.interval
      },
      () => this.getStatus()
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
