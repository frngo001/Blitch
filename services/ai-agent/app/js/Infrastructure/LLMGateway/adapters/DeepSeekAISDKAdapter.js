/**
 * DeepSeek Adapter using Vercel AI SDK
 *
 * Uses the native @ai-sdk/deepseek provider for optimal tool calling support.
 * Supports: deepseek-chat (V3), deepseek-reasoner (R1)
 *
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/deepseek
 */

import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText, streamText } from 'ai'
import { z } from 'zod'
import logger from '@overleaf/logger'
import { BaseAdapter } from './BaseAdapter.js'

export class DeepSeekAISDKAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com'

    // Available DeepSeek models
    // V3.2 supports combined thinking and tool use
    this.models = {
      'deepseek-chat': {
        name: 'DeepSeek Chat (V3)',
        maxTokens: 64000,
        pricing: { input: 0.27, output: 1.10 },
        tier: 'free',
        description: 'Fast and cost-effective chat model with tool support'
      },
      'deepseek-reasoner': {
        name: 'DeepSeek Reasoner (R1)',
        maxTokens: 64000,
        pricing: { input: 0.55, output: 2.19 },
        tier: 'pro',
        description: 'Advanced reasoning model - thinks before answering'
      }
    }

    // Native DeepSeek provider instance
    this.provider = null
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key is required')
    }

    // Create native DeepSeek provider
    this.provider = createDeepSeek({
      apiKey: this.apiKey,
      baseURL: this.baseUrl !== 'https://api.deepseek.com' ? this.baseUrl : undefined
    })

    this.initialized = true
    logger.info({ baseUrl: this.baseUrl }, 'DeepSeek AI SDK adapter initialized')
  }

  /**
   * Convert MCP tools to Vercel AI SDK tool format
   */
  convertToolsToAISDK(tools) {
    if (!tools || tools.length === 0) {
      return {}
    }

    const aiTools = {}
    for (const tool of tools) {
      const inputSchema = tool.input_schema || tool.parameters || { type: 'object', properties: {} }

      // Convert JSON Schema to Zod schema dynamically
      aiTools[tool.name] = {
        description: tool.description || '',
        parameters: this.jsonSchemaToZod(inputSchema)
      }
    }

    logger.info({ toolCount: Object.keys(aiTools).length, toolNames: Object.keys(aiTools) },
      'DeepSeek AI SDK: Converted tools')
    return aiTools
  }

  /**
   * Convert JSON Schema to Zod schema
   * Simple conversion for common cases
   */
  jsonSchemaToZod(schema) {
    if (!schema || schema.type !== 'object') {
      return z.object({})
    }

    const properties = schema.properties || {}
    const required = schema.required || []
    const zodShape = {}

    for (const [key, prop] of Object.entries(properties)) {
      let zodType

      switch (prop.type) {
        case 'string':
          zodType = z.string()
          if (prop.description) zodType = zodType.describe(prop.description)
          break
        case 'number':
        case 'integer':
          zodType = z.number()
          if (prop.description) zodType = zodType.describe(prop.description)
          break
        case 'boolean':
          zodType = z.boolean()
          if (prop.description) zodType = zodType.describe(prop.description)
          break
        case 'array':
          zodType = z.array(z.any())
          if (prop.description) zodType = zodType.describe(prop.description)
          break
        default:
          zodType = z.any()
          if (prop.description) zodType = zodType.describe(prop.description)
      }

      // Make optional if not in required array
      if (!required.includes(key)) {
        zodType = zodType.optional()
      }

      zodShape[key] = zodType
    }

    return z.object(zodShape)
  }

  normalizeRequest(request) {
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    return {
      model: request.model || 'deepseek-chat',
      max_tokens: request.maxTokens || request.max_tokens || 4096,
      messages,
      temperature: request.temperature ?? 0.7,
      stream: request.stream || false,
      tools: request.tools || []
    }
  }

  async complete(request) {
    if (!this.provider) {
      throw new Error('DeepSeek AI SDK adapter not initialized')
    }

    try {
      const model = this.provider(request.model || 'deepseek-chat')

      // Convert tools to AI SDK format
      const tools = this.convertToolsToAISDK(request.tools)
      const hasTools = Object.keys(tools).length > 0

      logger.info({
        model: request.model,
        hasTools,
        toolCount: Object.keys(tools).length
      }, 'DeepSeek AI SDK: Starting completion')

      const result = await generateText({
        model,
        messages: request.messages,
        maxTokens: request.max_tokens || 4096,
        temperature: request.temperature ?? 0.7,
        ...(hasTools && {
          tools,
          toolChoice: 'auto' // Let the model decide when to use tools
        })
      })

      logger.info({
        hasToolCalls: result.toolCalls?.length > 0,
        toolCallCount: result.toolCalls?.length || 0,
        finishReason: result.finishReason
      }, 'DeepSeek AI SDK: Completion finished')

      // Build response in standard format
      const response = {
        id: `deepseek-${Date.now()}`,
        content: result.text || '',
        model: request.model || 'deepseek-chat',
        usage: {
          input_tokens: result.usage?.promptTokens || 0,
          output_tokens: result.usage?.completionTokens || 0
        },
        stop_reason: result.finishReason === 'tool-calls' ? 'tool_use' : (result.finishReason || 'stop')
      }

      // Extract tool calls if present
      if (result.toolCalls && result.toolCalls.length > 0) {
        response.tool_calls = result.toolCalls.map((tc, index) => ({
          id: tc.toolCallId || `call_${index}`,
          type: 'function',
          name: tc.toolName,
          input: tc.args || {}
        }))
        response.stop_reason = 'tool_use'
        logger.info({
          toolCalls: response.tool_calls.map(tc => ({ name: tc.name, id: tc.id }))
        }, 'DeepSeek AI SDK: Tool calls detected')
      }

      return response
    } catch (error) {
      logger.error({ error, model: request.model }, 'DeepSeek AI SDK completion failed')
      throw error
    }
  }

  async *stream(request) {
    if (!this.provider) {
      throw new Error('DeepSeek AI SDK adapter not initialized')
    }

    try {
      const model = this.provider(request.model || 'deepseek-chat')

      // Convert tools to AI SDK format
      const tools = this.convertToolsToAISDK(request.tools)
      const hasTools = Object.keys(tools).length > 0

      logger.info({
        model: request.model,
        hasTools,
        toolCount: Object.keys(tools).length
      }, 'DeepSeek AI SDK: Starting stream')

      const result = await streamText({
        model,
        messages: request.messages,
        maxTokens: request.max_tokens || 4096,
        temperature: request.temperature ?? 0.7,
        ...(hasTools && {
          tools,
          toolChoice: 'auto'
        })
      })

      let totalUsage = { input_tokens: 0, output_tokens: 0 }
      const collectedToolCalls = []

      // Stream text deltas
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          yield {
            content: part.textDelta,
            done: false
          }
        } else if (part.type === 'tool-call') {
          // Collect tool calls
          collectedToolCalls.push({
            id: part.toolCallId,
            type: 'function',
            name: part.toolName,
            input: part.args || {}
          })

          // Emit tool_start event
          yield {
            type: 'tool_start',
            tool_call: {
              id: part.toolCallId,
              name: part.toolName,
              input: part.args || {}
            }
          }
        } else if (part.type === 'finish') {
          totalUsage = {
            input_tokens: part.usage?.promptTokens || 0,
            output_tokens: part.usage?.completionTokens || 0
          }
        }
      }

      // Final message
      yield {
        content: '',
        done: true,
        usage: {
          input: totalUsage.input_tokens,
          output: totalUsage.output_tokens
        },
        stop_reason: collectedToolCalls.length > 0 ? 'tool_use' : 'end_turn',
        tool_calls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined
      }

    } catch (error) {
      logger.error({ error, model: request.model }, 'DeepSeek AI SDK stream failed')
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
      finishReason: response.stop_reason || 'stop',
      tool_calls: response.tool_calls
    }
  }

  normalizeChunk(chunk) {
    return {
      content: chunk.content || '',
      done: chunk.done || false,
      usage: chunk.usage || null,
      tool_calls: chunk.tool_calls
    }
  }

  async healthCheck() {
    try {
      return {
        initialized: this.initialized,
        modelsAvailable: Object.keys(this.models).length,
        healthy: this.initialized && this.provider !== null,
        provider: 'ai-sdk'
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
    return 'deepseek'
  }
}
