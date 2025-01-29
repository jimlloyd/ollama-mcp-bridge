import { exec, type ExecOptions } from 'child_process';
import { promisify } from 'util';
import { BaseServiceManager } from '../../service/base';
import { ServiceError, ServiceConfig } from '../../service/types';
import { logger } from '../../logger';

const execAsync = promisify(exec);

/**
 * Unix-specific service manager implementation
 */
export class UnixServiceManager extends BaseServiceManager {
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

      // Check for existing process
      try {
        const { stdout } = await execAsync('pgrep ollama');
        const pid = parseInt(stdout.trim(), 10);
        if (pid) {
          logger.debug(`Found existing Ollama process (${pid}), stopping...`);
          await execAsync(`kill ${pid}`);
          // Wait for process to stop
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        // Process not found, continue
      }

      // Start service
      this.updateStatus({ state: 'starting' });
      const options: ExecOptions = {
        windowsHide: true,
        shell: '/bin/sh'
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
      this.updateStatus({ state: 'stopping' });

      try {
        const { stdout } = await execAsync('pgrep ollama');
        const pid = parseInt(stdout.trim(), 10);
        if (pid) {
          await execAsync(`kill ${pid}`);
          this.updateStatus({ running: false, state: 'stopped', pid: undefined });
          this.logStatusChange('stop');
          return;
        }
      } catch (error) {
        // Process not found, consider it stopped
        this.updateStatus({ running: false, state: 'stopped', pid: undefined });
        this.logStatusChange('stop');
        return;
      }
    } catch (error) {
      this.updateStatus({ state: 'error', lastError: error instanceof Error ? error.message : String(error) });
      this.logStatusChange('stop', error as Error);
      throw new ServiceError('Failed to stop service', await this.getStatus(), error as Error);
    }
  }
}
