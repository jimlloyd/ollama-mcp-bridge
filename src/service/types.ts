/**
 * Service status representation
 */
export interface ServiceStatus {
  running: boolean;
  pid?: number;
  port?: number;
  uptime?: number;
  lastError?: string;
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
}

/**
 * Service manager interface defining the contract for platform-specific implementations
 */
export interface ServiceManager {
  /**
   * Start the service
   * @throws {ServiceError} if service fails to start
   */
  startService(): Promise<void>;

  /**
   * Stop the service
   * @throws {ServiceError} if service fails to stop
   */
  stopService(): Promise<void>;

  /**
   * Check if the service is healthy
   * @returns true if service is running and responding
   */
  checkHealth(): Promise<boolean>;

  /**
   * Get detailed service status
   */
  getStatus(): Promise<ServiceStatus>;

  /**
   * Wait for service to be healthy
   * @param timeout Maximum time to wait in milliseconds
   * @param interval Check interval in milliseconds
   * @returns true if service becomes healthy within timeout
   */
  waitForHealth(timeout?: number, interval?: number): Promise<boolean>;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  port: number;
  healthCheck: {
    timeout: number;
    interval: number;
  };
  command: string;
  args?: string[];
}

/**
 * Base class for service-related errors
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: ServiceStatus,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Error thrown when service operation times out
 */
export class ServiceTimeoutError extends ServiceError {
  constructor(
    operation: 'start' | 'stop' | 'health',
    timeout: number,
    status?: ServiceStatus
  ) {
    super(
      `Service ${operation} operation timed out after ${timeout}ms`,
      status
    );
    this.name = 'ServiceTimeoutError';
  }
}
