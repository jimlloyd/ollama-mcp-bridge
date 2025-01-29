import { ServiceManagerFactory } from '../factory';
import { ServiceConfig } from '../types';
import { UnixServiceManager } from '../../platform/unix/service';
import { WindowsServiceManager } from '../../platform/windows/service';

describe('ServiceManager', () => {
  const mockConfig: ServiceConfig = {
    port: 11434,
    healthCheck: {
      timeout: 30000,
      interval: 1000
    },
    command: 'ollama serve'
  };

  describe('Factory', () => {
    it('creates Unix manager for linux platform', () => {
      const manager = ServiceManagerFactory.createForPlatform('linux', mockConfig);
      expect(manager).toBeInstanceOf(UnixServiceManager);
    });

    it('creates Unix manager for darwin platform', () => {
      const manager = ServiceManagerFactory.createForPlatform('darwin', mockConfig);
      expect(manager).toBeInstanceOf(UnixServiceManager);
    });

    it('creates Windows manager for win32 platform', () => {
      const manager = ServiceManagerFactory.createForPlatform('win32', mockConfig);
      expect(manager).toBeInstanceOf(WindowsServiceManager);
    });

    it('throws error for unsupported platform', () => {
      expect(() => {
        ServiceManagerFactory.createForPlatform('unsupported', mockConfig);
      }).toThrow('Unsupported platform: unsupported');
    });
  });

  describe('Health Check', () => {
    let manager: UnixServiceManager;
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
      manager = new UnixServiceManager(mockConfig);
      // Mock fetch globally
      fetchMock = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchMock.mockRestore();
    });

    it('returns true when service is healthy', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response);
      const result = await manager.checkHealth();
      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags');
    });

    it('returns false when service is not responding', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await manager.checkHealth();
      expect(result).toBe(false);
    });

    it('returns false when service returns non-ok status', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false } as Response);
      const result = await manager.checkHealth();
      expect(result).toBe(false);
    });
  });

  describe('Service Status', () => {
    let manager: UnixServiceManager;

    beforeEach(() => {
      manager = new UnixServiceManager(mockConfig);
    });

    it('reports correct status when service is running', async () => {
      jest.spyOn(manager, 'checkHealth').mockResolvedValueOnce(true);
      const status = await manager.getStatus();
      expect(status).toEqual({
        running: true,
        state: 'running'
      });
    });

    it('reports correct status when service is stopped', async () => {
      jest.spyOn(manager, 'checkHealth').mockResolvedValueOnce(false);
      const status = await manager.getStatus();
      expect(status).toEqual({
        running: false,
        state: 'stopped'
      });
    });
  });
});
