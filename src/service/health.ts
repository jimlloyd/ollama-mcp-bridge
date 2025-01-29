import { ServiceStatus } from './types';
import { HealthCheckError, TimeoutError } from './errors';

import Debug from 'debug-level';
const logger = new Debug('health');

export interface HealthCheckConfig {
  timeout: number;
  interval: number;
  maxAttempts?: number;
}

export interface HealthChecker {
  check(): Promise<boolean>;
}

/**
 * Default implementation of health checking logic
 */
export class ServiceHealthChecker implements HealthChecker {
  constructor(
    private port: number,
    private endpoint: string = '/api/tags'
  ) {}

  async check(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${this.port}${this.endpoint}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Wait for a service to become healthy with configurable timeout and retry logic
 */
export async function waitForHealth(
  checker: HealthChecker,
  config: HealthCheckConfig,
  currentStatus: () => Promise<ServiceStatus>
): Promise<void> {
  const start = Date.now();
  let attempts = 0;
  const maxAttempts = config.maxAttempts || Math.floor(config.timeout / config.interval);

  while (attempts < maxAttempts) {
    if (await checker.check()) {
      logger.debug('Health check passed');
      return;
    }

    if (Date.now() - start >= config.timeout) {
      const status = await currentStatus();
      throw new TimeoutError(
        'Health check timed out',
        'health_check',
        config.timeout
      );
    }

    attempts++;
    logger.debug(`Health check attempt ${attempts}/${maxAttempts} failed, waiting ${config.interval}ms...`);
    await new Promise(resolve => setTimeout(resolve, config.interval));
  }

  const status = await currentStatus();
  throw new HealthCheckError(
    'Health check failed after maximum attempts',
    status,
    attempts
  );
}

/**
 * Create a health checker for a specific service
 */
export function createHealthChecker(port: number, endpoint?: string): HealthChecker {
  return new ServiceHealthChecker(port, endpoint);
}
