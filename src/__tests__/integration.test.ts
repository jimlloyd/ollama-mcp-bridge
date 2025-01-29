import { MCPLLMBridge } from '../bridge';
import { createServiceManager, ServiceConfig } from '../service';

import Debug from 'debug-level';
const logger = new Debug('integration:test');

describe('Service Integration', () => {
  let serviceManager: ReturnType<typeof createServiceManager>;
  let bridge: MCPLLMBridge;

  beforeEach(() => {
    const serviceConfig: ServiceConfig = {
      port: 11434,
      healthCheck: {
        timeout: 5000,  // Shorter timeout for tests
        interval: 500
      },
      command: 'ollama serve'
    };
    serviceManager = createServiceManager(serviceConfig);

    // Mock bridge configuration
    const bridgeConfig = {
      mcpServer: {
        command: 'node',
        args: ['test-server.js']
      },
      mcpServerName: 'test',
      mcpServers: {},
      llmConfig: {
        model: 'test-model',
        baseUrl: 'http://localhost:11434',
        systemPrompt: 'Test prompt'
      }
    };

    bridge = new MCPLLMBridge(bridgeConfig);
  });

  afterEach(async () => {
    await serviceManager.stopService().catch(() => {});
  });

  describe('Service Lifecycle', () => {
    it('should start and stop service', async () => {
      // Mock fetch for health checks
      global.fetch = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({ ok: true }))  // First health check
        .mockImplementationOnce(() => Promise.resolve({ ok: false })); // Second health check

      // Start service
      await serviceManager.startService();
      const runningStatus = await serviceManager.getStatus();
      expect(runningStatus.running).toBe(true);
      expect(runningStatus.state).toBe('running');

      // Stop service
      await serviceManager.stopService();
      const stoppedStatus = await serviceManager.getStatus();
      expect(stoppedStatus.running).toBe(false);
      expect(stoppedStatus.state).toBe('stopped');
    });

    it('should handle service failures gracefully', async () => {
      // Mock fetch to simulate service failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      try {
        await serviceManager.startService();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        const status = await serviceManager.getStatus();
        expect(status.state).toBe('error');
      }
    });
  });

  describe('Bridge Integration', () => {
    beforeEach(() => {
      // Mock fetch for health checks and API calls
      global.fetch = jest.fn()
        .mockImplementation((url) => {
          if (url.endsWith('/api/tags')) {
            return Promise.resolve({ ok: true });
          }
          if (url.endsWith('/api/chat')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                message: {
                  role: 'assistant',
                  content: 'Test response'
                }
              })
            });
          }
          return Promise.reject(new Error(`Unexpected URL: ${url}`));
        });
    });

    it('should process messages through the bridge', async () => {
      await bridge.initialize();
      const response = await bridge.processMessage('test message');
      expect(response).toBe('Test response');
    });

    it('should handle bridge shutdown gracefully', async () => {
      await bridge.initialize();
      await expect(bridge.close()).resolves.not.toThrow();
    });
  });
});
