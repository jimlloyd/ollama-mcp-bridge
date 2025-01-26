import { exec, type ExecOptions } from 'child_process';
import { logger } from '../../logger';
import { ProcessManager, ProcessInfo } from '../types';

export class WindowsProcessManager implements ProcessManager {
  async findProcess(name: string): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
        exec(`tasklist /FI "IMAGENAME eq ${name}" /FO CSV /NH`, (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout });
          }
        });
      });

      // Parse CSV output to get PID
      const match = stdout.match(new RegExp(`"${name}","([0-9]+)"`));
      if (match && match[1]) {
        return {
          pid: parseInt(match[1], 10),
          name
        };
      }
      return null;
    } catch (error) {
      // Process not found or error occurred
      return null;
    }
  }

  async startProcess(command: string): Promise<void> {
    const options: ExecOptions = {
      windowsHide: true
    };

    const process = exec(command, options);

    // Handle output to prevent buffer issues
    process.stdout?.on('data', (data) => {
      logger.debug(`${command} stdout:`, data.toString());
    });
    process.stderr?.on('data', (data) => {
      logger.debug(`${command} stderr:`, data.toString());
    });

    // Detach process
    process.unref();
  }

  async stopProcess(name: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        exec(`taskkill /IM ${name}`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      // Wait briefly for process to stop
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      logger.debug(`Failed to stop process ${name} gracefully:`, error);
      // If graceful stop fails, try force stop
      await this.forceStopProcess(name);
    }
  }

  async forceStopProcess(name: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      exec(`taskkill /F /IM ${name}`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async isProcessRunning(name: string): Promise<boolean> {
    return (await this.findProcess(name)) !== null;
  }
}
