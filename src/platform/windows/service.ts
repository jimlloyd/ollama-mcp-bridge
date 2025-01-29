import { exec, type ExecOptions } from 'child_process';
import { BaseServiceManager } from '../../service/base';
import { ServiceError, ServiceConfig } from '../../service/types';
import { logger } from '../../logger';

/**
 * Windows-specific service manager implementation using health checks
 * instead of aggressive process management
 */
export class WindowsServiceManager extends BaseServiceManager {
  constructor(config: ServiceConfig) {
    super(config);
  }

  async startService(): Promise<void> {
    try {
      // Check if already running
      if (await this.checkHealth()) {
        logger.debug('Service already running');
        return;
      }

      // Start service
      this.updateStatus({ state: 'starting' });
      const options: ExecOptions = {
        windowsHide: true
      };
      const process = exec(this.config.command, options);

      // Handle output to prevent buffer issues
      process.stdout?.on('data', (data) => {
        logger.debug('Ollama stdout:', data.toString());
      });
      process.stderr?.on('data', (data) => {
        logger.debug('Ollama stderr:', data.toString());
      });
      process.unref();

      // Wait for service to be healthy
      await this.waitForHealth();

      this.logStatusChange('start');
    } catch (error) {
      this.updateStatus({ state: 'error', lastError: error instanceof Error ? error.message : String(error) });
      this.logStatusChange('start', error as Error);
      throw new ServiceError('Failed to start service', await this.getStatus(), error as Error);
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

      // Use taskkill as a last resort, preferring graceful shutdown
      try {
        await new Promise<void>((resolve, reject) => {
          exec('taskkill /IM ollama.exe', (error) => {
            if (error) {
              // If normal kill fails, force it
              exec('taskkill /F /IM ollama.exe', (forceError) => {
                if (forceError) {
                  reject(forceError);
                } else {
                  resolve();
                }
              });
            } else {
              resolve();
            }
          });
        });

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
        throw new Error(`Failed to stop service: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      this.updateStatus({ state: 'error', lastError: error instanceof Error ? error.message : String(error) });
      this.logStatusChange('stop', error as Error);
      throw new ServiceError('Failed to stop service', await this.getStatus(), error as Error);
    }
  }
}
