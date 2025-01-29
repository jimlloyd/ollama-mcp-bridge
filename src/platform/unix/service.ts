import { BaseServiceManager } from '../../service/base';
import { ServiceError, ProcessError, PlatformError } from '../../service/errors';
import { ServiceConfig } from '../../service/types';
import { createHealthChecker } from '../../service/health';
import { UnixProcessManager } from './process';

import Logger from 'debug-level';
const logger = new Logger('service:unix');

/**
 * Unix-specific service manager implementation
 */
export class UnixServiceManager extends BaseServiceManager {
  private processManager: UnixProcessManager;

  constructor(config: ServiceConfig) {
    super(config);
    this.processManager = new UnixProcessManager();
  }

  async startService(): Promise<void> {
    try {
      // Check if already running
      if (await this.checkHealth()) {
        logger.debug('Service already running');
        return;
      }

      this.updateStatus({ state: 'starting' });

      // Stop any existing process
      try {
        if (await this.processManager.isProcessRunning('ollama')) {
          await this.processManager.stopProcess('ollama');
        }
      } catch (error) {
        throw new ProcessError(
          'Failed to stop existing process',
          'ollama',
          'stop',
          error as Error
        );
      }

      // Start service
      try {
        await this.processManager.startProcess(this.config.command);
      } catch (error) {
        throw new ProcessError(
          'Failed to start process',
          'ollama',
          'start',
          error as Error
        );
      }

      // Wait for service to be healthy
      const healthChecker = createHealthChecker(this.config.port);
      await this.waitForHealth(healthChecker);

      this.logStatusChange('start');
    } catch (error) {
      const wrappedError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof ProcessError || error instanceof ServiceError) {
        throw error;
      }

      throw new PlatformError(
        'Failed to start service on Unix platform',
        'unix',
        'start',
        wrappedError
      );
    }
  }

  async stopService(): Promise<void> {
    try {
      this.updateStatus({ state: 'stopping' });

      try {
        await this.processManager.stopProcess('ollama');
        this.updateStatus({ running: false, state: 'stopped' });
        this.logStatusChange('stop');
      } catch (error) {
        throw new ProcessError(
          'Failed to stop process',
          'ollama',
          'stop',
          error as Error
        );
      }
    } catch (error) {
      const wrappedError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof ProcessError || error instanceof ServiceError) {
        throw error;
      }

      throw new PlatformError(
        'Failed to stop service on Unix platform',
        'unix',
        'stop',
        wrappedError
      );
    }
  }
}
