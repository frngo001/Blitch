/**
 * Anthropic Adapter
 *
 * Adapter for Claude models (Opus 4, Sonnet 4, Haiku 3.5)
 */

import Anthropic from '@anthropic-ai/sdk'
import logger from '@overleaf/logger'
import { BaseAdapter } from './BaseAdapter.js'

export class AnthropicAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.client = null

    // Available Claude models
    this.models = {
      'claude-opus-4': {
        name: 'Claude Opus 4',
        maxTokens: 200000,
        pricing: { input: 15.00, output: 75.00 },
        tier: 'enterprise',
        description: 'Most capable model for complex scientific reasoning'
      },
      'claude-sonnet-4': {
        name: 'Claude Sonnet 4',
        maxTokens: 200000,
        pricing: { input: 3.00, output: 15.00 },
        tier: 'pro',
        description: 'Balanced model for scientific writing'
      },
      'claude-3-5-sonnet': {
        name: 'Claude 3.5 Sonnet',
        maxTokens: 200000,
        pricing: { input: 3.00, output: 15.00 },
        tier: 'pro',
        description: 'Previous generation balanced model'
      },
      'claude-3-5-haiku': {
        name: 'Claude 3.5 Haiku',
        maxTokens: 200000,
        pricing: { input: 0.80, output: 4.00 },
        tier: 'free',
        description: 'Fast and cost-effective for simple tasks'
      }
    }
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required')
    }

    this.client = new Anthropic({
      apiKey: this.apiKey
    })

    this.initialized = true
    logger.info('Anthropic adapter initialized')
  }

  normalizeRequest(request) {
    const messages = request.messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))

    // Extract system message if present
    let system = null
    const systemMsg = request.messages.find(m => m.role === 'system')
    if (systemMsg) {
      system = systemMsg.content
    }

    const normalized = {
      model: this.mapModelName(request.model),
      max_tokens: request.maxTokens || request.max_tokens || 4096,
      messages: messages.filter(m => m.role !== 'system'),
      system,
      temperature: request.temperature ?? 0.7,
      stream: request.stream || false
    }

    // Add tools if provided (for agentic capabilities)
    if (request.tools && request.tools.length > 0) {
      normalized.tools = request.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema || tool.parameters || { type: 'object', properties: {} }
      }))
      logger.info({ toolCount: request.tools.length }, 'Anthropic: Adding tools to request')
    }

    return normalized
  }

  /**
   * Map our model names to Anthropic API names
   */
  mapModelName(model) {
    const mapping = {
      'claude-opus-4': 'claude-opus-4-20250514',
      'claude-sonnet-4': 'claude-sonnet-4-20250514',
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku': 'claude-3-5-haiku-20241022'
    }
    return mapping[model] || model
  }

  async complete(request) {
    if (!this.client) {
      throw new Error('Anthropic adapter not initialized')
    }

    try {
      const params = {
        model: request.model,
        max_tokens: request.max_tokens,
        messages: request.messages,
        system: request.system,
        temperature: request.temperature
      }

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        params.tools = request.tools
      }

      const response = await this.client.messages.create(params)

      // Extract text content and tool calls
      let textContent = ''
      const toolCalls = []

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            name: block.name,
            input: block.input
          })
        }
      }

      const result = {
        id: response.id,
        content: textContent,
        model: response.model,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        },
        stop_reason: response.stop_reason
      }

      // Add tool calls if present
      if (toolCalls.length > 0) {
        result.tool_calls = toolCalls
        logger.info({ toolCallCount: toolCalls.length, toolNames: toolCalls.map(tc => tc.name) }, 'Anthropic: Tool calls in response')
      }

      return result
    } catch (error) {
      logger.error({ error, model: request.model }, 'Anthropic completion failed')
      throw error
    }
  }

  async *stream(request) {
    if (!this.client) {
      throw new Error('Anthropic adapter not initialized')
    }

    try {
      const params = {
        model: request.model,
        max_tokens: request.max_tokens,
        messages: request.messages,
        system: request.system,
        temperature: request.temperature,
        stream: true
      }

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        params.tools = request.tools
      }

      const stream = await this.client.messages.create(params)

      let totalUsage = { input_tokens: 0, output_tokens: 0 }
      let stopReason = 'end_turn'
      const toolCalls = []
      let currentToolCall = null

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          // Check if this is a tool_use block
          if (event.content_block?.type === 'tool_use') {
            currentToolCall = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: {}
            }
            // Emit tool_start event
            yield {
              type: 'tool_start',
              tool_call: {
                id: currentToolCall.id,
                name: currentToolCall.name,
                input: {}
              }
            }
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            yield {
              content: event.delta?.text || '',
              done: false
            }
          } else if (event.delta?.type === 'input_json_delta' && currentToolCall) {
            // Accumulate tool input JSON
            // The input comes in chunks, we'll parse it at the end
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolCall) {
            toolCalls.push({
              id: currentToolCall.id,
              type: 'function',
              name: currentToolCall.name,
              input: currentToolCall.input
            })
            currentToolCall = null
          }
        } else if (event.type === 'message_delta') {
          if (event.usage) {
            totalUsage = {
              input_tokens: event.usage.input_tokens || totalUsage.input_tokens,
              output_tokens: event.usage.output_tokens || totalUsage.output_tokens
            }
          }
          if (event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason
          }
        } else if (event.type === 'message_stop') {
          yield {
            content: '',
            done: true,
            usage: {
              input: totalUsage.input_tokens,
              output: totalUsage.output_tokens
            },
            stop_reason: stopReason,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
          }
        }
      }
    } catch (error) {
      logger.error({ error, model: request.model }, 'Anthropic stream failed')
      throw error
    }
  }

  normalizeResponse(response) {
    return {
      id: response.id,
      content: response.content,
      role: 'assistant',
      model: response.model,
      usage: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0
      },
      finishReason: response.stop_reason || 'stop'
    }
  }

  normalizeChunk(chunk) {
    return {
      content: chunk.content || '',
      done: chunk.done || false,
      usage: chunk.usage || null
    }
  }

  async healthCheck() {
    try {
      // Simple health check - just verify client exists
      return {
        initialized: this.initialized,
        modelsAvailable: Object.keys(this.models).length,
        healthy: !!this.client
      }
    } catch (error) {
      return {
        initialized: this.initialized,
        modelsAvailable: 0,
        healthy: false,
        error: error.message
      }
    }
  }

  get name() {
    return 'anthropic'
  }
}
