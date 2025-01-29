# Manual Testing Guide

## Prerequisites
1. Ensure Ollama is installed
2. Ensure you have a model downloaded (e.g., `ollama pull mistral`)
3. Make sure port 11434 is available

## Test 1: Basic Service Management
```bash
# Start the application
npm start

# Test sequence:
1. Enter any prompt - verify Ollama starts automatically
2. Enter another prompt - verify it reuses the same Ollama instance
3. Use Ctrl+C to quit - verify Ollama shuts down gracefully
```

Expected results:
- No Windows-specific error messages
- No aggressive process killing messages
- Clean startup and shutdown

## Test 2: Service Recovery
```bash
# Start the application
npm start

# Test sequence:
1. Enter a prompt to start Ollama
2. Manually kill Ollama (pkill ollama or Task Manager)
3. Enter another prompt - verify automatic recovery
```

Expected results:
- Service detects failure
- Automatically restarts Ollama
- Continues processing prompts

## Test 3: Multiple Sessions
```bash
# In terminal 1
npm start

# In terminal 2
npm start

# Test sequence:
1. Enter prompts in both terminals
2. Verify they don't interfere with each other
3. Close one session, verify the other continues working
```

Expected results:
- Sessions work independently
- No port conflicts
- Clean shutdown of each session

## Test 4: Error Handling
```bash
# Start the application
npm start

# Test sequence:
1. Block port 11434 (e.g., with another service)
2. Enter a prompt
3. Unblock the port
4. Enter another prompt
```

Expected results:
- Clear error messages
- Graceful handling of port conflicts
- Recovery when port becomes available

## Common Issues to Watch For

1. Process Management:
   - No lingering Ollama processes after shutdown
   - No Windows-specific command errors
   - Clean process termination

2. Service Health:
   - Health checks working correctly
   - Appropriate timeout handling
   - Clear status messages

3. Error Messages:
   - Platform-agnostic error messages
   - Helpful troubleshooting information
   - No raw error dumps

## Troubleshooting

If issues occur:
1. Check process list for Ollama instances
2. Verify port 11434 availability
3. Check logs for platform-specific errors

Use these commands:
```bash
# Unix
lsof -i :11434
ps aux | grep ollama

# Windows
netstat -ano | findstr "11434"
tasklist | findstr "ollama"
```

Report any platform-specific issues or unexpected behaviors for further investigation.
