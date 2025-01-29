import { type LLMConfig } from './types';
import { logger } from './logger';
import { DynamicToolRegistry } from './tool-registry';
import { toolSchemas } from './types/tool-schemas';
import { createServiceManager, type ServiceConfig } from './service';

interface OllamaResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
}

interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolResponse {
  name?: string;
  arguments?: Record<string, unknown>;
  thoughts?: string;
}

export class LLMClient {
  private config: LLMConfig;
  private toolRegistry: DynamicToolRegistry | null = null;
  private currentTool: string | null = null;
  private serviceManager;
  public tools: any[] = [];
  private messages: any[] = [];
  public systemPrompt: string | null = null;
  private readonly toolSchemas: typeof toolSchemas = toolSchemas;
  private static REQUEST_TIMEOUT = 300000; // 5 minutes

  constructor(config: LLMConfig) {
    this.config = config;
    this.systemPrompt = config.systemPrompt || null;
    this.config.baseUrl = this.config.baseUrl.replace('localhost', '127.0.0.1');
    logger.debug(`Initializing Ollama client with baseURL: ${this.config.baseUrl}`);

    // Initialize service manager
    const serviceConfig: ServiceConfig = {
      port: 11434,
      healthCheck: {
        timeout: 30000,
        interval: 1000
      },
      command: 'ollama serve'
    };
    this.serviceManager = createServiceManager(serviceConfig);
  }

  setToolRegistry(registry: DynamicToolRegistry) {
    this.toolRegistry = registry;
    logger.debug('Tool registry set with tools:', registry.getAllTools());
  }

  public async listTools(): Promise<void> {
    logger.info('===== Available Tools =====');
    if (this.tools.length === 0) {
      logger.info('No tools available');
      return;
    }

    for (const tool of this.tools) {
      logger.info('\nTool Details:');
      logger.info(`Name: ${tool.function.name}`);
      logger.info(`Description: ${tool.function.description}`);
      if (tool.function.parameters) {
        logger.info('Parameters:');
        logger.info(JSON.stringify(tool.function.parameters, null, 2));
      }
      logger.info('------------------------');
    }
    logger.info(`Total tools available: ${this.tools.length}`);
  }

  private async testConnection(): Promise<boolean> {
    return this.serviceManager.checkHealth();
  }

  private prepareMessages(): any[] {
    const formattedMessages = [];
    if (this.systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: this.systemPrompt
      });
    }

    formattedMessages.push(...this.messages);
    return formattedMessages;
  }

  async invokeWithPrompt(prompt: string) {
    try {
      // Ensure service is running
      await this.serviceManager.startService();

      // Detect tool using registry if available
      if (this.toolRegistry) {
        this.currentTool = this.toolRegistry.detectToolFromPrompt(prompt);
        logger.debug(`Detected tool from registry: ${this.currentTool}`);
      }

      logger.debug(`Preparing to send prompt: ${prompt}`);
      this.messages = [];
      this.messages.push({
        role: 'user',
        content: prompt
      });

      return this.invoke([]);
    } catch (error) {
      logger.error('Error during prompt invocation:', error);
      throw error;
    }
  }

  async invoke(toolResults: any[] = []) {
    try {
      if (toolResults.length > 0) {
        for (const result of toolResults) {
          // Convert MCP response to proper Ollama tool call format
          const toolOutput = result.output;
          try {
            const parsedOutput = JSON.parse(toolOutput);
            if (parsedOutput.content && Array.isArray(parsedOutput.content)) {
              // Extract text content from MCP response
              const content = parsedOutput.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('\n');
              this.messages.push({
                role: 'tool',
                content,
                tool_call_id: result.tool_call_id
              });
            } else {
              this.messages.push({
                role: 'tool',
                content: String(toolOutput),
                tool_call_id: result.tool_call_id
              });
            }
          } catch (e) {
            // If not JSON, use as-is
            this.messages.push({
              role: 'tool',
              content: String(toolOutput),
              tool_call_id: result.tool_call_id
            });
          }
        }
      }

      const messages = this.prepareMessages();
      const payload: any = {
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: this.config.temperature || 0,
          num_predict: this.config.maxTokens || 1000
        }
      };

      // Add structured output format if a tool is detected
      if (this.currentTool) {
        const toolSchema = this.currentTool ? this.toolSchemas[this.currentTool as keyof typeof toolSchemas] : null;
        if (toolSchema) {
          payload.format = {
            type: "object",
            properties: {
              name: {
                type: "string",
                const: this.currentTool
              },
              arguments: toolSchema,
              thoughts: {
                type: "string",
                description: "Your thoughts about using this tool"
              }
            },
            required: ["name", "arguments", "thoughts"]
          };
          logger.debug('Added format schema for tool:', this.currentTool);
          logger.debug('Schema:', JSON.stringify(payload.format, null, 2));
        }
      }

      logger.debug('Preparing Ollama request with payload:', JSON.stringify(payload, null, 2));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        logger.error(`Request timed out after ${LLMClient.REQUEST_TIMEOUT/1000} seconds`);
      }, LLMClient.REQUEST_TIMEOUT);

      logger.debug('Sending request to Ollama...');
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Ollama request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      logger.debug('Response received from Ollama, parsing...');
      const completion = await response.json() as OllamaResponse;
      logger.debug('Parsed response:', completion);

      let isToolCall = false;
      let toolCalls: ToolCall[] = [];
      let content: any = completion.message.content;

      // Parse the structured response
      try {
        // Handle both string and object responses
        const contentObj = typeof content === 'string' ? JSON.parse(content) : content;

        // Check if response matches our structured format
        if (contentObj.name && contentObj.arguments) {
          isToolCall = true;
          toolCalls = [{
            id: `call-${Date.now()}`,
            function: {
              name: contentObj.name,
              arguments: JSON.stringify(contentObj.arguments)
            }
          }];
          content = contentObj.thoughts || "Using tool...";
          logger.debug('Parsed structured tool call:', { toolCalls });
        }
      } catch (e) {
        logger.debug('Response is not a structured tool call:', e);
      }

      const result = {
        content: typeof content === 'string' ? content : JSON.stringify(content),
        isToolCall,
        toolCalls
      };

      if (result.isToolCall) {
        this.messages.push({
          role: 'assistant',
          content: result.content,
          tool_calls: result.toolCalls?.map(call => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.function.name,
              arguments: call.function.arguments
            }
          }))
        });
      } else {
        this.messages.push({
          role: 'assistant',
          content: result.content
        });
      }

      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.error('Request aborted due to timeout');
        throw new Error(`Request timed out after ${LLMClient.REQUEST_TIMEOUT/1000} seconds`);
      }
      logger.error('LLM invocation failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.serviceManager.stopService();
    } catch (error) {
      logger.error('Error stopping service:', error);
    }
  }
}
