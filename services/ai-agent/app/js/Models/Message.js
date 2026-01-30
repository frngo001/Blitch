/**
 * Message Model
 *
 * Defines the structure for chat messages with full tool call support
 * Compatible with Claude/Anthropic message format
 */

/**
 * Message roles
 */
export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
  SYSTEM: 'system'
}

/**
 * Message types for different content kinds
 */
export const MessageContentType = {
  TEXT: 'text',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result'
}

/**
 * Stop reasons from LLM responses
 */
export const StopReason = {
  END_TURN: 'end_turn',
  TOOL_USE: 'tool_use',
  MAX_TOKENS: 'max_tokens',
  STOP_SEQUENCE: 'stop_sequence'
}

/**
 * Create a unique message ID
 */
export function createMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a user message
 * @param {string} content - User's message content
 * @param {Object} context - Optional document context
 * @returns {Object} User message object
 */
export function createUserMessage(content, context = null) {
  return {
    id: createMessageId(),
    role: MessageRole.USER,
    content: content,
    timestamp: new Date(),
    metadata: {
      document_context: context
    }
  }
}

/**
 * Create an assistant message with optional tool calls
 * @param {Object} response - LLM response object
 * @returns {Object} Assistant message object
 */
export function createAssistantMessage(response) {
  const message = {
    id: response.id || createMessageId(),
    role: MessageRole.ASSISTANT,
    content: response.content || '',
    timestamp: new Date(),
    stop_reason: response.stop_reason || response.finishReason || StopReason.END_TURN,
    metadata: {
      model: response.model,
      provider: response.provider,
      tokens_used: response.usage || { input: 0, output: 0 },
      latency_ms: response.latency_ms
    }
  }

  // Add tool calls if present (for tool_use stop reason)
  if (response.tool_calls && response.tool_calls.length > 0) {
    message.tool_calls = response.tool_calls.map(tc => ({
      id: tc.id || `toolu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'function',
      name: tc.name,
      input: tc.input || tc.arguments
    }))
  }

  return message
}

/**
 * Create a tool result message
 * @param {string} toolCallId - ID of the tool call being responded to
 * @param {string} toolName - Name of the tool
 * @param {*} result - Tool execution result
 * @param {boolean} isError - Whether the result is an error
 * @returns {Object} Tool result message object
 */
export function createToolResultMessage(toolCallId, toolName, result, isError = false) {
  return {
    id: createMessageId(),
    role: MessageRole.TOOL,
    tool_call_id: toolCallId,
    tool_name: toolName,
    content: typeof result === 'string' ? result : JSON.stringify(result),
    is_error: isError,
    timestamp: new Date()
  }
}

/**
 * Convert session messages to LLM API format (Claude/Anthropic compatible)
 * @param {Array} messages - Session messages array
 * @returns {Array} LLM-compatible messages array
 */
export function convertToLLMFormat(messages) {
  const llmMessages = []

  for (const msg of messages) {
    if (msg.role === MessageRole.USER) {
      llmMessages.push({
        role: 'user',
        content: msg.content
      })
    } else if (msg.role === MessageRole.ASSISTANT) {
      const content = []

      // Add text content if present
      if (msg.content) {
        content.push({
          type: 'text',
          text: msg.content
        })
      }

      // Add tool use blocks if present
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input
          })
        }
      }

      llmMessages.push({
        role: 'assistant',
        content: content.length === 1 && content[0].type === 'text'
          ? content[0].text  // Simple text response
          : content          // Array with tool calls
      })
    } else if (msg.role === MessageRole.TOOL) {
      // Find the previous assistant message to attach tool result
      const lastAssistantIndex = llmMessages.length - 1
      if (lastAssistantIndex >= 0 && llmMessages[lastAssistantIndex].role === 'assistant') {
        // Add tool result as user message (Claude's format)
        llmMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content,
            is_error: msg.is_error
          }]
        })
      }
    }
  }

  return llmMessages
}

/**
 * Calculate total tokens from messages
 * @param {Array} messages - Array of messages
 * @returns {Object} Token counts { input, output, total }
 */
export function calculateTotalTokens(messages) {
  let input = 0
  let output = 0

  for (const msg of messages) {
    if (msg.metadata?.tokens_used) {
      input += msg.metadata.tokens_used.input || 0
      output += msg.metadata.tokens_used.output || 0
    }
  }

  return { input, output, total: input + output }
}

/**
 * Extract tool calls from messages for display
 * @param {Array} messages - Array of messages
 * @returns {Array} Array of tool call summaries
 */
export function extractToolCalls(messages) {
  const toolCalls = []

  for (const msg of messages) {
    if (msg.role === MessageRole.ASSISTANT && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.name,
          timestamp: msg.timestamp,
          message_id: msg.id
        })
      }
    }
  }

  return toolCalls
}

/**
 * Get the last N messages (for context window management)
 * @param {Array} messages - Full message array
 * @param {number} limit - Max messages to return
 * @returns {Array} Truncated message array
 */
export function getRecentMessages(messages, limit = 20) {
  if (messages.length <= limit) {
    return messages
  }

  // Always include tool results with their corresponding tool calls
  const recent = []
  let count = 0
  let pendingToolResults = new Set()

  // Work backwards
  for (let i = messages.length - 1; i >= 0 && count < limit; i--) {
    const msg = messages[i]

    // Track tool calls we need results for
    if (msg.role === MessageRole.ASSISTANT && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        pendingToolResults.add(tc.id)
      }
    }

    // Check if this is a needed tool result
    if (msg.role === MessageRole.TOOL) {
      pendingToolResults.delete(msg.tool_call_id)
    }

    recent.unshift(msg)
    count++
  }

  return recent
}

/**
 * Validate message structure
 * @param {Object} message - Message to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateMessage(message) {
  const errors = []

  if (!message.id) {
    errors.push('Message must have an id')
  }

  if (!message.role || !Object.values(MessageRole).includes(message.role)) {
    errors.push(`Invalid role: ${message.role}`)
  }

  if (message.role === MessageRole.TOOL && !message.tool_call_id) {
    errors.push('Tool messages must have tool_call_id')
  }

  if (message.role !== MessageRole.TOOL && message.content === undefined) {
    errors.push('Non-tool messages must have content')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  MessageRole,
  MessageContentType,
  StopReason,
  createMessageId,
  createUserMessage,
  createAssistantMessage,
  createToolResultMessage,
  convertToLLMFormat,
  calculateTotalTokens,
  extractToolCalls,
  getRecentMessages,
  validateMessage
}
