import { ServiceStatus } from './types';

/**
 * Error codes for different types of failures
 */
export enum ErrorCode {
  ServiceError = 'SERVICE_ERROR',
  ProcessError = 'PROCESS_ERROR',
  ConfigError = 'CONFIG_ERROR',
  TimeoutError = 'TIMEOUT_ERROR',
  HealthCheckError = 'HEALTH_CHECK_ERROR',
  PlatformError = 'PLATFORM_ERROR'
}

/**
 * Base error class for all bridge-related errors
 */
export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

/**
 * Error thrown when service operations fail
 */
export class ServiceError extends BridgeError {
  constructor(
    message: string,
    public readonly serviceStatus: ServiceStatus,
    public readonly cause?: Error
  ) {
    super(message, ErrorCode.ServiceError, { serviceStatus, cause });
    this.name = 'ServiceError';
  }
}

/**
 * Error thrown when process operations fail
 */
export class ProcessError extends BridgeError {
  constructor(
    message: string,
    public readonly processName: string,
    public readonly operation: 'start' | 'stop' | 'find',
    public readonly cause?: Error
  ) {
    super(message, ErrorCode.ProcessError, { processName, operation, cause });
    this.name = 'ProcessError';
  }
}

/**
 * Error thrown when operations timeout
 */
export class TimeoutError extends BridgeError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(message, ErrorCode.TimeoutError, { operation, timeoutMs });
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when health checks fail
 */
export class HealthCheckError extends BridgeError {
  constructor(
    message: string,
    public readonly serviceStatus: ServiceStatus,
    public readonly attempts: number
  ) {
    super(message, ErrorCode.HealthCheckError, { serviceStatus, attempts });
    this.name = 'HealthCheckError';
  }
}

/**
 * Error thrown for platform-specific issues
 */
export class PlatformError extends BridgeError {
  constructor(
    message: string,
    public readonly platform: 'unix' | 'windows',
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message, ErrorCode.PlatformError, { platform, operation, cause });
    this.name = 'PlatformError';
  }
}
