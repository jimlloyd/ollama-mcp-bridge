# Ollama MCP Bridge Refactoring Plan

## Overview
This document outlines the plan for refactoring the Ollama MCP Bridge project to improve its architecture and cross-platform support while maintaining it as a single, cohesive project.

## Goals
1. Separate platform-specific code from core functionality
2. Simplify Windows process management
3. Improve maintainability and testability
4. Maintain project cohesion

## Project Structure

```
src/
  core/           # Platform-agnostic core functionality
    mcp/
      client.ts     # MCP client implementation
      protocol.ts   # Protocol definitions
      types.ts      # Shared types
    registry/
      tool.ts       # Tool registration system
      validation.ts # Tool validation logic
    config/
      loader.ts     # Configuration loading
      schema.ts     # Configuration schemas

  platform/       # Platform-specific implementations
    types.ts        # Platform interface definitions
    unix/
      service.ts    # Unix service management
      process.ts    # Unix process handling
    windows/
      service.ts    # Windows service management
      process.ts    # Windows process handling

  service/        # Service management layer
    manager.ts      # Abstract service manager
    health.ts       # Health checking utilities
    errors.ts       # Error definitions

  index.ts        # Main entry point
```

## Implementation Phases

### Phase 1: Core Restructuring
1. Create new directory structure
2. Move existing platform-agnostic code
3. Create interface definitions
4. Update imports and exports

### Phase 2: Service Management
1. Implement `ServiceManager` interface:
```typescript
interface ServiceManager {
  startService(): Promise<void>;
  stopService(): Promise<void>;
  checkHealth(): Promise<boolean>;
  getStatus(): Promise<ServiceStatus>;
}
```

2. Create platform-specific implementations:
```typescript
class UnixServiceManager implements ServiceManager {
  // Unix-specific implementation
}

class WindowsServiceManager implements ServiceManager {
  // Simplified Windows implementation
  // Replace aggressive process management with health checks
}
```

### Phase 3: Configuration Updates
1. Update configuration structure:
```typescript
interface BridgeConfig {
  platform: {
    type: 'unix' | 'windows';
    paths: PlatformPaths;
    commands: PlatformCommands;
  };
  service: {
    port: number;
    healthCheck: {
      timeout: number;
      interval: number;
    };
  };
  mcp: {
    // MCP-specific configuration
  };
}
```

2. Implement configuration validation

### Phase 4: Error Handling
1. Create error hierarchy:
```typescript
class BridgeError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

class ServiceError extends BridgeError {
  constructor(
    message: string,
    public readonly serviceStatus: ServiceStatus
  ) {
    super(message, ErrorCode.ServiceError, { serviceStatus });
  }
}
```

2. Implement error handling strategies

## Testing Strategy

### Unit Tests
```
tests/
  core/
    mcp/
      client.test.ts
      protocol.test.ts
    registry/
      tool.test.ts
    config/
      loader.test.ts

  platform/
    unix/
      service.test.ts
    windows/
      service.test.ts

  service/
    manager.test.ts
    health.test.ts
```

### Integration Tests
1. Service lifecycle tests
2. MCP communication tests
3. Tool execution tests
4. Error handling tests

## Migration Steps

### 1. Initial Setup
- Create new directory structure
- Set up test infrastructure
- Create interface definitions

### 2. Core Migration
- Move MCP implementation
- Move tool registry
- Update configuration system

### 3. Service Layer
- Implement service management
- Create health checking
- Add error handling

### 4. Platform Support
- Implement Unix support
- Create simplified Windows support
- Add platform detection

## Success Criteria
1. All tests passing
2. No platform-specific code in core
3. Simplified Windows implementation
4. Improved error handling
5. Comprehensive test coverage

## Benefits
1. **Maintainability**
   - Clear separation of concerns
   - Platform-specific code isolation
   - Improved testability

2. **Reliability**
   - Better error handling
   - Health-check based management
   - Graceful degradation

3. **Extensibility**
   - Easy to add platform support
   - Clear interface contracts
   - Modular design

## Future Considerations
1. Potential for future modularization
2. Possible extraction of reusable components
3. Contribution to upstream Ollama project

This refactoring plan provides a clear path forward while maintaining project cohesion and improving the overall architecture. By keeping everything within the current project, we can move quickly and iterate effectively while setting up for potential future modularization if needed.
