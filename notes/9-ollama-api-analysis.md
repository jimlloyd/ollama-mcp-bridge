# Ollama API Integration Analysis

## Current Implementation Overview

The bridge between MCP and Ollama uses Ollama's chat API with function calling capabilities. The key components are:

1. **Message Role Handling**
   - Uses native Ollama message roles: 'system', 'user', 'assistant', 'tool'
   - Tool responses properly use the 'tool' role with name and tool_call_id
   - System prompts guide response formatting

2. **Tool Calling Flow**
   ```typescript
   // Initial request -> structured format
   {
     role: 'user',
     content: userPrompt
   }

   // Tool call response -> uses tool role
   {
     role: 'tool',
     content: toolOutput,
     name: toolName,
     tool_call_id: id
   }

   // Final response -> natural language
   {
     role: 'assistant',
     content: naturalResponse
   }
   ```

## Alignment with Ollama API

### Strengths
1. **Message Roles**
   - Correctly uses Ollama's native message role system
   - Tool responses properly structured with required metadata
   - System prompts guide response formatting effectively

2. **Function Calling**
   - Properly implements function calling schema
   - Correctly handles tool call detection and execution
   - Maintains proper message history for context

3. **Response Handling**
   - Uses native format for tool responses
   - Properly processes structured and unstructured responses
   - Maintains conversation context appropriately

### Areas for Improvement

1. **System Prompt Management**
   ```typescript
   // Current: System prompts are set per tool
   this.llmClient.systemPrompt = instructions;

   // Recommendation: Consider maintaining a base system prompt
   const basePrompt = "Base instructions...";
   const toolPrompt = "Tool-specific instructions...";
   this.llmClient.systemPrompt = `${basePrompt}\n\n${toolPrompt}`;
   ```

2. **Message History**
   - Consider implementing message history truncation to prevent context overflow
   - Add support for conversation memory management
   - Consider adding conversation state tracking

3. **Error Handling**
   - Add specific handling for Ollama API error responses
   - Implement retry logic for transient failures
   - Add validation for message format compliance

4. **Tool Response Formatting**
   ```typescript
   // Current: Direct content passing
   content: outputContent

   // Recommendation: Add structured metadata
   content: {
     result: outputContent,
     status: 'success',
     metadata: {
       timestamp: Date.now(),
       source: toolName
     }
   }
   ```

## Recommendations

1. **Base System Prompt**
   - Create a consistent base system prompt that sets fundamental behavior
   - Layer tool-specific instructions on top of base prompt
   - Document prompt engineering patterns

2. **Message Management**
   ```typescript
   class MessageManager {
     private maxHistory: number;
     private messages: Message[];

     truncateHistory() {
       // Implement smart truncation
     }

     addMessage(message: Message) {
       // Add with overflow protection
     }
   }
   ```

3. **Error Handling Enhancement**
   ```typescript
   try {
     const response = await fetch(`${this.config.baseUrl}/api/chat`...);
     if (!response.ok) {
       const error = await response.json();
       // Handle specific Ollama error types
       switch(error.code) {
         case 'context_length_exceeded':
           // Handle context length
           break;
         // ... other cases
       }
     }
   } catch (error) {
     // Enhanced error handling
   }
   ```

4. **Conversation State Management**
   - Implement conversation ID tracking
   - Add support for conversation forking
   - Implement conversation state persistence

## Future Considerations

1. **Streaming Support**
   - Add support for streaming responses
   - Implement progressive tool output handling
   - Consider WebSocket integration for real-time updates

2. **Model Configuration**
   - Add support for model-specific configurations
   - Implement parameter tuning based on conversation context
   - Add support for model switching mid-conversation

3. **Performance Optimization**
   - Implement message batching
   - Add support for parallel tool execution
   - Consider caching for frequently used tool responses

## Test Suite Alignment

### Current Test Limitations

1. **Hard-Coded JSON Format**
   - Tests currently enforce JSON formatting through system prompts
   - Relies on string parsing and cleanup of markdown code blocks
   - Doesn't leverage Ollama's native format validation

2. **Missing Test Coverage**
   - No tests for tool response handling
   - No validation of message role transitions
   - Limited error case coverage
   - No tests for conversation context maintenance

### Recommended Test Improvements

1. **Current Test Coverage**
   ```typescript
   // Current test approach
   const payload = {
     messages: [
       {
         role: 'system',
         content: 'Format: {"tool_name":"write_file",...}'
       }
     ]
   };
   ```

2. **Recommended Test Updates**
   ```typescript
   // Updated test approach using native function calling
   const payload = {
     messages: [
       {
         role: 'system',
         content: 'Use the provided tools to accomplish tasks.'
       }
     ],
     format: {
       type: "object",
       properties: {
         name: { type: "string", const: "write_file" },
         arguments: {
           type: "object",
           properties: {
             path: { type: "string" },
             content: { type: "string" }
           },
           required: ["path", "content"]
         }
       }
     }
   };
   ```

3. **Example Test Cases**
   ```typescript
   describe('Ollama Native Function Calling', () => {
     it('should handle tool calls correctly', async () => {
       const payload = {
         messages: [
           {
             role: 'user',
             content: 'create test.txt containing hello'
           }
         ],
         format: {
           type: "object",
           properties: {
             name: { type: "string", enum: ["write_file"] },
             arguments: {
               type: "object",
               properties: {
                 path: { type: "string" },
                 content: { type: "string" }
               },
               required: ["path", "content"]
             }
           }
         }
       };
       // Test tool call detection and execution
     });

     it('should process tool responses properly', async () => {
       const messages = [
         {
           role: 'user',
           content: 'create test.txt containing hello'
         },
         {
           role: 'tool',
           name: 'write_file',
           content: 'File created successfully',
           tool_call_id: 'call-123'
         }
       ];
       // Test natural language response generation
     });

     it('should maintain conversation context', async () => {
       const messages = [
         {
           role: 'user',
           content: 'create test.txt'
         },
         {
           role: 'assistant',
           content: 'I will help you create test.txt'
         },
         {
           role: 'tool',
           name: 'write_file',
           content: 'File created successfully',
           tool_call_id: 'call-123'
         }
       ];
       // Test context awareness in responses
     });
   });
   ```

4. **Test Infrastructure and Tooling**

   a. **Mock Server Implementation**
   ```typescript
   class MockOllamaServer {
     async handleRequest(payload: any) {
       // Validate message role transitions
       this.validateMessageRoles(payload.messages);

       // Handle function calling format
       if (payload.format) {
         return this.handleFunctionCall(payload);
       }

       // Handle tool responses
       if (this.isToolResponse(payload.messages)) {
         return this.generateNaturalResponse(payload);
       }
     }

     private validateMessageRoles(messages: any[]) {
       // Ensure proper role sequence:
       // user -> assistant -> tool -> assistant
       const validTransitions = {
         user: ['assistant'],
         assistant: ['user', 'tool'],
         tool: ['assistant'],
         system: ['user', 'assistant']
       };
     }
   }
   ```

   b. **Test Utilities**
   ```typescript
   const testUtils = {
     createToolCall: (name: string, args: any) => ({
       role: 'assistant',
       content: '',
       function_call: {
         name,
         arguments: JSON.stringify(args)
       }
     }),

     createToolResponse: (id: string, content: string) => ({
       role: 'tool',
       content,
       tool_call_id: id
     }),

     validateMessageSequence: (messages: any[]) => {
       // Validate role transitions and message format
     }
   };
   ```

   c. **Integration Test Workflow**
   ```typescript
   describe('Tool Interaction Workflow', () => {
     it('should handle complete tool interaction cycle', async () => {
       // 1. Initial user request
       // 2. Tool call detection
       // 3. Tool execution
       // 4. Response formatting
       // 5. Context maintenance
     });
   });
   ```

   d. **Performance Metrics**
   ```typescript
   interface TestMetrics {
     messageProcessingTime: number;
     toolCallDetectionTime: number;
     responseGenerationTime: number;
     contextSwitchingTime: number;
   }

   const collectMetrics = async (testFn: () => Promise<void>): Promise<TestMetrics> => {
     // Measure performance characteristics
   };
   ```

5. **Test Infrastructure Improvements**
   - Add mock Ollama server for testing
   - Create test utilities for common message patterns
   - Add integration tests for complete tool workflows
   - Add performance benchmarking tests

## Implementation Priority

1. High Priority
   - Base system prompt implementation
   - Message history management
   - Enhanced error handling
   - Test suite alignment with native Ollama patterns

2. Medium Priority
   - Conversation state management
   - Tool response metadata
   - Performance optimizations
   - Mock server implementation

3. Future Enhancements
   - Streaming support
   - Advanced model configuration
   - Conversation persistence
   - Comprehensive test coverage

## Conclusion

The current implementation effectively uses Ollama's API capabilities, particularly in message role handling and function calling. The recommended improvements focus on robustness, scalability, and maintainability while maintaining alignment with Ollama's API design patterns.

The priority should be implementing the high-priority improvements, particularly the base system prompt and message history management, as these will provide immediate benefits to system stability and user experience.
