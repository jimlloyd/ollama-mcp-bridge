import { type LLMConfig } from './types';
import { DynamicToolRegistry } from './tool-registry';
import { toolSchemas } from './types/tool-schemas';
import { createServiceManager, type ServiceConfig } from './service';
import chalk from 'chalk';

const bold = chalk.bold.blue;

import Debug from 'debug-level';
const logger = new Debug('llm_client');

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
    logger.debug(`Tool registry set with tools: ${JSON.stringify(registry.getAllTools(), null, 2)}`);
  }

  public async listTools(): Promise<void> {
    console.info('===== Available Tools =====');
    if (this.tools.length === 0) {
      console.info('No tools available');
      return;
    }

    for (const tool of this.tools) {
      console.info(bold('\nTool Details:'));
      console.info(`Name: ${bold(tool.function.name)}`);
      console.info(`Description: ${tool.function.description}`);
      if (tool.function.parameters) {
        console.info('Parameters:');
        console.info(JSON.stringify(tool.function.parameters, null, 2));
      }
      console.info('------------------------');
    }
    console.info(`Total tools available: ${this.tools.length}`);
  }

  private async testConnection(): Promise<boolean> {
    return this.serviceManager.checkHealth();
  }

  private prepareMessages(): any[] {
    const formattedMessages = [];

    // Add system prompt if present
    if (this.systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: this.systemPrompt
      });
    }

    // Add all messages with simple role/content structure
    for (const message of this.messages) {
      formattedMessages.push({
        role: message.role,
        content: message.content
      });
    }

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
          let outputContent = '';
          try {
            const parsedOutput = JSON.parse(toolOutput);
            if (parsedOutput.content && Array.isArray(parsedOutput.content)) {
              // Extract text content from MCP response
              outputContent = parsedOutput.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('\n');
            } else {
              outputContent = String(toolOutput);
            }
          } catch (e) {
            // If not JSON, use as-is
            outputContent = String(toolOutput);
          }

          // Format according to Ollama's function call response format
          // Add tool response with correct role and tool_call_id
          this.messages.push({
            role: 'tool',
            content: outputContent,
            name: result.tool_name || '',
            tool_call_id: result.tool_call_id
          });
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

      // Only use structured output format for initial requests, not tool responses
      if (toolResults.length === 0) {
        payload.format = {
          type: "object",
          properties: {
            name: {
              type: "string",
              enum: this.tools.map(t => t.function.name)
            },
            arguments: {
              type: "object",
              additionalProperties: true
            },
            thoughts: {
              type: "string",
              description: "Your thoughts about the response or tool usage"
            }
          },
          required: ["name", "arguments", "thoughts"]
        };

        // If a specific tool is detected, add its schema
        if (this.currentTool) {
          const toolSchema = this.currentTool ? this.toolSchemas[this.currentTool as keyof typeof toolSchemas] : null;
          if (toolSchema) {
            payload.format.properties.arguments = toolSchema;
            payload.format.properties.name.const = this.currentTool;
            logger.debug('Added specific tool schema', { tool: this.currentTool });
          }
        }

        logger.debug(`Using format schema: ${JSON.stringify(payload.format, null, 2)}`);
      }

      logger.debug(`Prepared messages for Ollama: ${JSON.stringify(messages, null, 2)}`);
      logger.debug(`Preparing Ollama request: ${JSON.stringify(payload, null, 2)}`);

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
        logger.error(`Ollama request failed: status=${response.status}, statusText=${response.statusText}, details=${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      logger.debug('Response received from Ollama, parsing...');
      const completion = await response.json() as OllamaResponse;
      logger.debug(`Parsed response: ${JSON.stringify(completion, null, 2)}`);

      let isToolCall = false;
      let toolCalls: ToolCall[] = [];
      let content: any = completion.message.content;

      // Only parse as tool call if this wasn't a tool response
      if (toolResults.length === 0) {
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
            // Log the structured tool call details at debug level
            logger.debug(`Tool call details: ${JSON.stringify(contentObj, null, 2)}`);
            content = ''; // Don't include thoughts in regular output
            logger.debug(`Parsed structured tool call: ${JSON.stringify(toolCalls, null, 2)}`);
          }
        } catch (e) {
          logger.debug('Response is not a structured tool call:', e);
        }
      } else {
        // For tool responses, just use the content directly
        logger.debug('Using tool response content directly');
      }

      let result;
      if (toolResults.length > 0) {
        // For tool responses, format the content for human consumption
        result = {
          content: content,
          isToolCall: false,
          toolCalls: []
        };
      } else {
        // For initial requests, maintain the structured format
        result = {
          content: typeof content === 'string' ? content : JSON.stringify(content),
          isToolCall,
          toolCalls
        };
      }

      // Add the response to messages
      this.messages.push({
        role: 'assistant',
        content: result.content
      });

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
