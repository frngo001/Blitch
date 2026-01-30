/**
 * MCP Client
 *
 * Connects to MCP servers (like claude-skills-mcp) and provides
 * tool definitions that can be used with any LLM provider.
 *
 * Uses stdio transport to communicate with MCP servers.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn } from 'child_process'
import logger from '@overleaf/logger'

class MCPClient {
  constructor() {
    this.client = null
    this.transport = null
    this.tools = []
    this.connected = false
    this.serverProcess = null
  }

  /**
   * Connect to an MCP server
   * @param {Object} config - Server configuration
   * @param {string} config.command - Command to run (e.g., 'uvx')
   * @param {Array} config.args - Command arguments (e.g., ['claude-skills-mcp'])
   * @param {Object} config.env - Environment variables
   */
  async connect(config = {}) {
    const {
      command = 'uvx',
      args = ['claude-skills-mcp'],
      env = {}
    } = config

    try {
      logger.info({ command, args }, 'Starting MCP server')

      // Create stdio transport with command configuration
      // The StdioClientTransport handles spawning the process internally
      this.transport = new StdioClientTransport({
        command,
        args,
        env: { ...process.env, ...env }
      })

      // Create MCP client
      this.client = new Client({
        name: 'overleaf-ai-agent',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      })

      // Connect to the server with extended timeout for first-run downloads (5 minutes)
      await this.client.connect(this.transport, { timeout: 300000 })
      this.connected = true

      logger.info('Connected to MCP server')

      // Load available tools
      await this.loadTools()

      return true
    } catch (error) {
      logger.error({ error }, 'Failed to connect to MCP server')
      this.connected = false
      throw error
    }
  }

  /**
   * Load available tools from the MCP server
   */
  async loadTools() {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server')
    }

    try {
      const response = await this.client.listTools()
      this.tools = response.tools || []

      logger.info({
        toolCount: this.tools.length,
        toolNames: this.tools.map(t => t.name)
      }, 'Loaded MCP tools')

      return this.tools
    } catch (error) {
      logger.error({ error }, 'Failed to load MCP tools')
      throw error
    }
  }

  /**
   * Get tools in a format suitable for LLM providers
   * @returns {Array} Tools formatted for LLM tool-use
   */
  getToolDefinitions() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }))
  }

  /**
   * Execute a tool call
   * @param {string} toolName - Name of the tool to call
   * @param {Object} toolInput - Input parameters for the tool
   * @returns {Object} Tool execution result
   */
  async callTool(toolName, toolInput) {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server')
    }

    logger.info({ toolName, toolInput }, 'Executing MCP tool')

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: toolInput
      })

      logger.info({
        toolName,
        hasContent: !!result.content,
        isError: result.isError
      }, 'MCP tool executed')

      // Extract text content from result
      let content = ''
      if (result.content && Array.isArray(result.content)) {
        content = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n')
      } else if (typeof result.content === 'string') {
        content = result.content
      }

      return {
        content,
        isError: result.isError || false
      }
    } catch (error) {
      logger.error({ error, toolName }, 'MCP tool execution failed')
      return {
        content: `Error executing tool: ${error.message}`,
        isError: true
      }
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close()
      }
      if (this.serverProcess) {
        this.serverProcess.kill()
      }
      this.connected = false
      this.tools = []
      logger.info('Disconnected from MCP server')
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from MCP server')
    }
  }

  /**
   * Check if connected to MCP server
   */
  isConnected() {
    return this.connected
  }

  /**
   * Get list of available tool names
   */
  getToolNames() {
    return this.tools.map(t => t.name)
  }
}

// Singleton instance
let mcpClient = null

export async function getMCPClient(config) {
  if (!mcpClient) {
    mcpClient = new MCPClient()
    await mcpClient.connect(config)
  }
  return mcpClient
}

export function getMCPClientSync() {
  return mcpClient
}

export { MCPClient }
