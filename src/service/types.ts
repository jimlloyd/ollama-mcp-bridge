import { HealthChecker } from './health';

export interface ServiceStatus {
  running: boolean;
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  pid?: number;
  lastError?: string;
}

export interface ServiceConfig {
  command: string;
  port: number;
  healthCheck: {
    timeout: number;
    interval: number;
    maxAttempts?: number;
  };
}

export interface ServiceManager {
  /**
   * Start the service
   */
  startService(): Promise<void>;

  /**
   * Stop the service
   */
  stopService(): Promise<void>;

  /**
   * Check if the service is healthy
   */
  checkHealth(): Promise<boolean>;

  /**
   * Get current service status
   */
  getStatus(): Promise<ServiceStatus>;

  /**
   * Wait for service to become healthy
   * @param checker Optional custom health checker
   */
  waitForHealth(checker?: HealthChecker): Promise<void>;
}

/**
 * Error thrown when a service operation times out
 */
export class ServiceTimeoutError extends Error {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
    public readonly status: ServiceStatus
  ) {
    super(`Service ${operation} timed out after ${timeoutMs}ms`);
    this.name = 'ServiceTimeoutError';
  }
}
