import { exec, type ExecOptions } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../logger';
import { ProcessManager, ProcessInfo } from '../types';

const execAsync = promisify(exec);

export class UnixProcessManager implements ProcessManager {
  async findProcess(name: string): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(`pgrep ${name}`);
      const pid = parseInt(stdout.trim(), 10);
      return pid ? { pid, name } : null;
    } catch (error) {
      // Process not found
      return null;
    }
  }

  async startProcess(command: string): Promise<void> {
    const options: ExecOptions = {
      windowsHide: true,
      shell: '/bin/sh'
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
    const process = await this.findProcess(name);
    if (process) {
      await execAsync(`kill ${process.pid}`);
      // Wait briefly for process to stop
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async forceStopProcess(name: string): Promise<void> {
    const process = await this.findProcess(name);
    if (process) {
      await execAsync(`kill -9 ${process.pid}`);
    }
  }

  async isProcessRunning(name: string): Promise<boolean> {
    return (await this.findProcess(name)) !== null;
  }
}
