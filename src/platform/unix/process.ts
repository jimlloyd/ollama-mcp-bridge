import { exec, type ExecOptions } from 'child_process';
import { promisify } from 'util';
import { ProcessManager, ProcessInfo } from '../../platform/types';

import Debug from 'debug-level';
const logger = new Debug('process_manager');

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
      const output = data.toString().trim();
      if (output) {
        logger.trace(`${command} stdout ${output}`, { output });
      }
    });
    process.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.debug(`${command} stderr ${output}`, { output });
      }
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
