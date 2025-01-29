/**
 * Information about a running process
 */
export interface ProcessInfo {
  pid: number;
  name: string;
}

/**
 * Platform-agnostic process management interface
 */
export interface ProcessManager {
  /**
   * Find a process by name
   * @returns ProcessInfo if found, null otherwise
   */
  findProcess(name: string): Promise<ProcessInfo | null>;

  /**
   * Start a new process with the given command
   */
  startProcess(command: string): Promise<void>;

  /**
   * Attempt to gracefully stop a process
   */
  stopProcess(name: string): Promise<void>;

  /**
   * Force stop a process
   */
  forceStopProcess(name: string): Promise<void>;

  /**
   * Check if a process is running
   */
  isProcessRunning(name: string): Promise<boolean>;
}

/**
 * Platform-specific service configuration
 */
export interface PlatformConfig {
  type: 'unix' | 'windows';
  paths: {
    executable: string;
    dataDir: string;
  };
  commands: {
    start: string;
    stop: string;
  };
}
