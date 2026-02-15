
import { describe, expect, it } from 'vitest';
import { registerTools } from './registry';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Mock Server
class MockServer {
  handlers = new Map();

  setRequestHandler(schema: any, handler: any) {
    this.handlers.set(schema, handler);
  }
}

describe('Registry Security', () => {
  it('should prevent path traversal in help tool', async () => {
    const server = new MockServer();
    const notionToken = 'mock-token';

    registerTools(server as any, notionToken);

    const handler = server.handlers.get(CallToolRequestSchema);
    expect(handler).toBeDefined();

    // Attempt path traversal
    const result = await handler({
      params: {
        name: 'help',
        arguments: {
          tool_name: '../../SECURITY'
        }
      }
    });

    // We expect the handler to catch the error and return an error response
    expect(result.isError).toBe(true);

    // Check if the error message indicates invalid tool name or restricted access
    // This confirms the fix prevents reading arbitrary files
    const content = result.content[0].text;
    expect(content).not.toContain('# Security Policy'); // Ensure content is NOT leaked
    expect(content).toContain('Invalid tool name');
  });

  it('should allow valid tool names in help tool', async () => {
    const server = new MockServer();
    const notionToken = 'mock-token';

    registerTools(server as any, notionToken);

    const handler = server.handlers.get(CallToolRequestSchema);

    const result = await handler({
      params: {
        name: 'help',
        arguments: {
          tool_name: 'pages'
        }
      }
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(result.content[0].text);
    expect(content.tool).toBe('pages');
    expect(content.documentation).toBeDefined();
  });
});
