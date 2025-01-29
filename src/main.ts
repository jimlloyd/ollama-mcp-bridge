import readline from 'readline';
import { MCPLLMBridge } from './bridge';
import { loadBridgeConfig } from './config';
import { logger } from './logger';
import { BridgeConfig } from './types';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  try {
    logger.info('Starting main.ts...');
    const configFile = await loadBridgeConfig();

    // Create bridge config with all MCPs
    const bridgeConfig: BridgeConfig = {
      mcpServer: configFile.mcpServers.filesystem,  // Primary MCP
      mcpServerName: 'filesystem',
      mcpServers: configFile.mcpServers,           // All MCPs including Flux
      llmConfig: configFile.llm!,
      systemPrompt: configFile.systemPrompt
    };

    logger.info('Initializing bridge with MCPs:', Object.keys(configFile.mcpServers).join(', '));
    const bridge = new MCPLLMBridge(bridgeConfig);
    const initialized = await bridge.initialize();

    if (!initialized) {
      throw new Error('Failed to initialize bridge');
    }

    logger.info('Available commands:');
    logger.info('  list-tools: Show all available tools and their parameters');
    logger.info('  quit: Exit the program');
    logger.info('  Any other input will be sent to the LLM');

    let isClosing = false;

    // Handle graceful shutdown
    async function shutdown() {
      if (isClosing) return;
      isClosing = true;
      logger.info('Shutting down...');
      try {
        await bridge.close();
      } catch (error) {
        logger.error('Error during shutdown:', error);
      }
      rl.close();
      process.exit(0);
    }

    // Set up signal handlers
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    while (!isClosing) {
      try {
        const userInput = await question("\nEnter your prompt (or 'list-tools' or 'quit'): ");

        if (userInput.toLowerCase() === 'quit') {
          await shutdown();
          break;
        }

        if (userInput.toLowerCase() === 'list-tools') {
          await bridge.llmClient.listTools();
          continue;
        }

        logger.info('Processing user input...');
        const response = await bridge.processMessage(userInput);
        logger.info('Received response from bridge');
        console.log(`\nResponse: ${response}`);
      } catch (error: any) {
        logger.error(`Error occurred: ${error?.message || String(error)}`);
      }
    }
  } catch (error: any) {
    logger.error(`Fatal error: ${error?.message || String(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error(`Unhandled error: ${error?.message || String(error)}`);
    process.exit(1);
  });
}

export { main };
