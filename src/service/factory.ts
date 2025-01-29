import { ServiceManager, ServiceConfig } from './types';
import { UnixServiceManager } from '../platform/unix/service';
import { WindowsServiceManager } from '../platform/windows/service';
import { logger } from '../logger';

/**
 * Factory for creating platform-specific service managers
 */
export class ServiceManagerFactory {
  /**
   * Create a service manager appropriate for the current platform
   */
  static create(config: ServiceConfig): ServiceManager {
    switch (process.platform) {
      case 'win32':
        logger.debug('Creating Windows service manager');
        return new WindowsServiceManager(config);

      case 'linux':
      case 'darwin':
        logger.debug('Creating Unix service manager');
        return new UnixServiceManager(config);

      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  }

  /**
   * Create a service manager for a specific platform (useful for testing)
   */
  static createForPlatform(platform: string, config: ServiceConfig): ServiceManager {
    switch (platform) {
      case 'win32':
        return new WindowsServiceManager(config);
      case 'linux':
      case 'darwin':
        return new UnixServiceManager(config);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}
