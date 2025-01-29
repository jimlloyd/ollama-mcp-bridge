# Debug Package Migration Plan

## Overview
Migrate console.log statements to the `debug` package to reduce test output noise and provide better control over logging levels.

## Current State
Most logging occurs in test files with the following categories:
- Request/Response logging (payloads, timing)
- Test execution status
- Error logging
- Process management logging

## Implementation Steps

### 1. Package Setup
```bash
npm install debug
npm install @types/debug --save-dev
```

### 2. Debug Namespace Structure
Create the following debug namespaces:
- `debug:ollama:test` - Ollama test specific logging
- `debug:mcp:test` - MCP test related logging
- `debug:request` - API request/response logging
- `debug:process` - Process management logging

### 3. Files to Modify

#### High Priority
- tests/ollama.test.ts
  * Replace request/response logging
  * Replace test status logging
  * Replace error logging

#### Medium Priority
- tests/mcp-tools.test.ts
  * Replace request/response logging
- tests/mcp/test-utils.ts
  * Create shared debug utilities
  * Replace process management logging

#### Lower Priority
- tests/mcp/flux.test.ts
  * Replace tool response logging
- tests/mcp/memory.test.ts
  * Replace test status logging
- src/main.ts
  * Replace response logging

### 4. Shared Debug Utility
Create a new file `tests/test-debug.ts`:
```typescript
import debug from 'debug';

export const debugOllamaTest = debug('debug:ollama:test');
export const debugMcpTest = debug('debug:mcp:test');
export const debugRequest = debug('debug:request');
export const debugProcess = debug('debug:process');
```

### 5. Usage Documentation
Add to README.md:
```markdown
## Debug Output
To enable debug output during tests, set the DEBUG environment variable:

- All debug output: `DEBUG=debug:*`
- Ollama test output: `DEBUG=debug:ollama:test`
- MCP test output: `DEBUG=debug:mcp:test`
- Request logging: `DEBUG=debug:request`
- Process logging: `DEBUG=debug:process`

Example:
```bash
DEBUG=debug:ollama:test npm test
```
```

## Benefits
- Reduced noise in test output by default
- Granular control over logging categories
- Consistent logging pattern across tests
- Better debugging experience with namespace filtering

## Migration Order
1. Create shared debug utility
2. Migrate ollama.test.ts as proof of concept
3. Migrate test-utils.ts to provide shared functionality
4. Migrate remaining test files
5. Update documentation
