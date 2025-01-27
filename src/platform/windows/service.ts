import { BaseServiceManager } from '../../service/base';
import { ServiceError, ProcessError, PlatformError } from '../../service/errors';
import { ServiceConfig } from '../../service/types';
import { createHealthChecker } from '../../service/health';
import { WindowsProcessManager } from './process';

import Logger from 'debug-level';
const logger = new Logger('service:windows');

/**
 * Windows-specific service manager implementation using health checks
 * instead of aggressive process management
 */
export class WindowsServiceManager extends BaseServiceManager {
  private processManager: WindowsProcessManager;

  constructor(config: ServiceConfig) {
    super(config);
    this.processManager = new WindowsProcessManager();
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
        if (await this.processManager.isProcessRunning('ollama.exe')) {
          await this.processManager.stopProcess('ollama.exe');
        }
      } catch (error) {
        throw new ProcessError(
          'Failed to stop existing process',
          'ollama.exe',
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
          'ollama.exe',
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
        'Failed to start service on Windows platform',
        'windows',
        'start',
        wrappedError
      );
    }
  }

  async stopService(): Promise<void> {
    try {
      // If service isn't running, nothing to do
      if (!(await this.checkHealth())) {
        this.updateStatus({ running: false, state: 'stopped' });
        return;
      }

      this.updateStatus({ state: 'stopping' });

      try {
        await this.processManager.stopProcess('ollama.exe');

        // Wait for service to stop
        let attempts = 0;
        while (attempts < 5) {
          if (!(await this.checkHealth())) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        this.updateStatus({ running: false, state: 'stopped' });
        this.logStatusChange('stop');
      } catch (error) {
        // If normal stop fails, try force stop
        try {
          await this.processManager.forceStopProcess('ollama.exe');
          this.updateStatus({ running: false, state: 'stopped' });
          this.logStatusChange('stop');
        } catch (forceError) {
          throw new ProcessError(
            'Failed to force stop process',
            'ollama.exe',
            'stop',
            forceError as Error
          );
        }
      }
    } catch (error) {
      const wrappedError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof ProcessError || error instanceof ServiceError) {
        throw error;
      }

      throw new PlatformError(
        'Failed to stop service on Windows platform',
        'windows',
        'stop',
        wrappedError
      );
    }
  }
}
