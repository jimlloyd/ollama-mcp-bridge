import debug from 'debug';

export const debugOllamaTest = debug('debug:ollama:test');
export const debugMcpTest = debug('debug:mcp:test');
export const debugRequest = debug('debug:request');
export const debugProcess = debug('debug:process');

// Helper functions for common debug patterns
export const debugRequest_payload = (payload: any) =>
  debugRequest('Request payload: %O', payload);

export const debugRequest_timing = (startTime: number) =>
  debugRequest('Request took %dms', Date.now() - startTime);

export const debugRequest_response = (response: any) =>
  debugRequest('Response: %O', response);

export const debugError = (namespace: debug.Debugger, error: any) =>
  namespace('Error: %O', error);
