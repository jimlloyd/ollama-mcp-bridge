import { ServiceManagerFactory } from './factory';
import type { ServiceConfig } from './types';

export * from './types';
export * from './base';
export * from './factory';

// Re-export platform-specific implementations
export { UnixServiceManager } from '../platform/unix/service';
export { WindowsServiceManager } from '../platform/windows/service';

// Default export for convenience
export { ServiceManagerFactory as default } from './factory';

/**
 * Create a service manager for the current platform
 */
export function createServiceManager(config: ServiceConfig) {
  return ServiceManagerFactory.create(config);
}
