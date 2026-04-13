/**
 * Better Notion MCP Server — Stdio entry point
 * Delegates to transports/stdio for the actual implementation
 */

import { startStdio } from './transports/stdio.js'

/** @deprecated Use startStdio() from './transports/stdio.js' directly */
export const initServer = startStdio
