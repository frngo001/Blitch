/**
 * Agentic Loop Handler
 *
 * Handles automatic tool execution and conversation continuation
 * Implements the agentic loop pattern where the LLM can call tools
 * and continue reasoning until the task is complete.
 */

import logger from '@overleaf/logger'
import { SessionManager } from '../Session/SessionManager.js'
import { getMCPClientSync } from '../../Infrastructure/MCP/MCPClient.js'
import { StopReason } from '../../Models/Message.js'

export class AgenticLoopHandler {
  /**
   * @param {Object} options
   * @param {number} options.maxIterations - Maximum number of tool execution iterations
   * @param {Object} options.toolExecutors - Map of tool name to executor function
   */
  constructor(options = {}) {
    this.maxIterations = options.maxIterations || 10
    this.toolExecutors = options.toolExecutors || {}
  }

  /**
   * Execute the agentic loop
   * Automatically executes tool calls and continues conversation until done
   *
   * @param {Object} session - The chat session
   * @param {Object} gateway - LLM gateway instance
   * @param {Object} requestOptions - Options for LLM requests
   * @param {Function} emitEvent - Function to emit SSE events
   * @param {Function} buildMessages - Function to build LLM messages from session
   * @returns {Object} Final response from the LLM
   */
  async executeLoop(session, gateway, requestOptions, emitEvent, buildMessages) {
    let iteration = 0
    let currentSession = session

    // Get initial response
    let response = await gateway.complete(requestOptions)

    // Persist initial response
    await SessionManager.addAssistantMessage(currentSession._id, response)

    // Loop while model requests tool use
    while (
      response.stop_reason === StopReason.TOOL_USE &&
      response.tool_calls &&
      response.tool_calls.length > 0 &&
      iteration < this.maxIterations
    ) {
      iteration++
      logger.info({
        iteration,
        toolCalls: response.tool_calls.length,
        toolNames: response.tool_calls.map(tc => tc.name)
      }, 'Agentic loop: executing tool calls')

      // Execute all tool calls
      for (const toolCall of response.tool_calls) {
        // Emit tool_start event
        emitEvent('tool_start', {
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input
        })

        // Execute the tool
        const result = await this.executeTool(toolCall)

        // Emit tool_end event
        emitEvent('tool_end', {
          id: toolCall.id,
          name: toolCall.name,
          output: result.content,
          is_error: result.is_error
        })

        // Persist tool result to session
        await SessionManager.addToolResultMessage(
          currentSession._id,
          toolCall.id,
          toolCall.name,
          result.content,
          result.is_error
        )
      }

      // Get updated session with all messages including tool results
      currentSession = await SessionManager.getSessionWithHistory(
        currentSession._id,
        requestOptions.userId
      )

      // Build continuation messages
      const continuationMessages = buildMessages(currentSession.messages)

      // Continue conversation with tool results
      response = await gateway.complete({
        ...requestOptions,
        messages: continuationMessages
      })

      // Persist the continuation response
      await SessionManager.addAssistantMessage(currentSession._id, response)

      // Emit token content if present
      if (response.content) {
        emitEvent('token', { content: response.content })
      }
    }

    if (iteration >= this.maxIterations) {
      logger.warn({
        sessionId: currentSession._id,
        iterations: iteration
      }, 'Agentic loop: max iterations reached')
    }

    return response
  }

  /**
   * Execute a single tool call
   *
   * @param {Object} toolCall - The tool call to execute
   * @returns {Object} Result with content and is_error flag
   */
  async executeTool(toolCall) {
    const { name, input } = toolCall

    // Check for custom executor first
    if (this.toolExecutors[name]) {
      try {
        const result = await this.toolExecutors[name](input)
        return {
          content: typeof result === 'string' ? result : JSON.stringify(result),
          is_error: false
        }
      } catch (error) {
        logger.error({ error, tool: name }, 'Tool execution failed')
        return {
          content: `Error executing ${name}: ${error.message}`,
          is_error: true
        }
      }
    }

    // Try MCP tools
    const mcpClient = getMCPClientSync()
    if (mcpClient && mcpClient.isConnected()) {
      const mcpTools = mcpClient.getToolDefinitions()
      const isMCPTool = mcpTools.some(t => t.name === name)

      if (isMCPTool) {
        try {
          const result = await mcpClient.callTool(name, input)
          return {
            content: result.content || JSON.stringify(result),
            is_error: result.isError || false
          }
        } catch (error) {
          logger.error({ error, tool: name }, 'MCP tool execution failed')
          return {
            content: `MCP tool error: ${error.message}`,
            is_error: true
          }
        }
      }
    }

    // Unknown tool
    logger.warn({ tool: name }, 'Unknown tool requested')
    return {
      content: `Unknown tool: ${name}. Available tools: ${Object.keys(this.toolExecutors).join(', ')}`,
      is_error: true
    }
  }

  /**
   * Register a tool executor
   *
   * @param {string} name - Tool name
   * @param {Function} executor - Async function that executes the tool
   */
  registerTool(name, executor) {
    this.toolExecutors[name] = executor
  }

  /**
   * Register multiple tool executors
   *
   * @param {Object} executors - Map of tool name to executor function
   */
  registerTools(executors) {
    this.toolExecutors = { ...this.toolExecutors, ...executors }
  }
}

/**
 * Create an AgenticLoopHandler with default AI-specific tools
 *
 * @param {Object} options
 * @returns {AgenticLoopHandler}
 */
export function createAgenticHandler(options = {}) {
  const handler = new AgenticLoopHandler(options)

  // Register built-in tools
  handler.registerTools({
    // Tool for applying content to document (handled by frontend)
    'apply_to_document': async (input) => {
      // This tool's result is handled by the frontend
      // We just return a confirmation that it was queued
      return {
        action: 'apply',
        content: input.content,
        mode: input.mode || 'replace',
        queued: true
      }
    },

    // Tool for reading current document selection
    'get_document_selection': async (input) => {
      // This would be implemented via WebSocket to frontend
      // For now, return a placeholder
      return {
        message: 'Document selection retrieval requires frontend context',
        note: 'Use the context provided in the initial message'
      }
    }
  })

  return handler
}

export default AgenticLoopHandler
