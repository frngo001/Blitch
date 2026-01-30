/**
 * DeepSeek Adapter
 *
 * Adapter for DeepSeek models (uses OpenAI-compatible API)
 * Models: deepseek-chat, deepseek-reasoner
 */

import logger from '@overleaf/logger'
import { BaseAdapter } from './BaseAdapter.js'

export class DeepSeekAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com'

    // Available DeepSeek models
    this.models = {
      'deepseek-chat': {
        name: 'DeepSeek Chat (V3)',
        maxTokens: 64000,
        pricing: { input: 0.27, output: 1.10 }, // Per million tokens
        tier: 'free',
        description: 'Fast and cost-effective chat model'
      },
      'deepseek-reasoner': {
        name: 'DeepSeek Reasoner (R1)',
        maxTokens: 64000,
        pricing: { input: 0.55, output: 2.19 },
        tier: 'pro',
        description: 'Advanced reasoning model for complex tasks'
      }
    }
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key is required')
    }

    // Verify API key with a test request (optional)
    this.initialized = true
    logger.info({ baseUrl: this.baseUrl }, 'DeepSeek adapter initialized')
  }

  normalizeRequest(request) {
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const normalized = {
      model: request.model || 'deepseek-chat',
      max_tokens: request.maxTokens || request.max_tokens || 4096,
      messages,
      temperature: request.temperature ?? 0.7,
      stream: request.stream || false
    }

    // Add tools if provided (OpenAI-compatible format)
    if (request.tools && request.tools.length > 0) {
      normalized.tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema || tool.parameters || { type: 'object', properties: {} }
        }
      }))
      logger.info({ toolCount: request.tools.length }, 'DeepSeek: Adding tools to request')
    }

    return normalized
  }

  async complete(request) {
    try {
      const body = {
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        stream: false
      }

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools
      }

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      const result = {
        id: data.id,
        content: message?.content || '',
        model: data.model,
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0
        },
        stop_reason: data.choices[0]?.finish_reason || 'stop'
      }

      // Extract tool calls if present (OpenAI format)
      if (message?.tool_calls && message.tool_calls.length > 0) {
        result.tool_calls = message.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function',
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}')
        }))
        result.stop_reason = 'tool_use'
        logger.info({ toolCallCount: result.tool_calls.length }, 'DeepSeek: Tool calls in response')
      }

      return result
    } catch (error) {
      logger.error({ error, model: request.model }, 'DeepSeek completion failed')
      throw error
    }
  }

  async *stream(request) {
    try {
      const body = {
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        stream: true
      }

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools
      }

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let totalUsage = { input_tokens: 0, output_tokens: 0 }
      let stopReason = 'end_turn'
      const toolCalls = new Map() // Track tool calls by index

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          const finalToolCalls = Array.from(toolCalls.values())
          yield {
            content: '',
            done: true,
            usage: {
              input: totalUsage.input_tokens,
              output: totalUsage.output_tokens
            },
            stop_reason: stopReason,
            tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            if (data === '[DONE]') {
              const finalToolCalls = Array.from(toolCalls.values())
              yield {
                content: '',
                done: true,
                usage: {
                  input: totalUsage.input_tokens,
                  output: totalUsage.output_tokens
                },
                stop_reason: stopReason,
                tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
              }
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              const content = delta?.content || ''
              const finishReason = parsed.choices?.[0]?.finish_reason

              // Update stop reason
              if (finishReason) {
                stopReason = finishReason === 'tool_calls' ? 'tool_use' : finishReason
              }

              // Update usage if provided
              if (parsed.usage) {
                totalUsage = {
                  input_tokens: parsed.usage.prompt_tokens || totalUsage.input_tokens,
                  output_tokens: parsed.usage.completion_tokens || totalUsage.output_tokens
                }
              }

              // Handle tool calls in stream (OpenAI format)
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const index = tc.index
                  if (!toolCalls.has(index)) {
                    // New tool call
                    toolCalls.set(index, {
                      id: tc.id || `call_${index}`,
                      type: 'function',
                      name: tc.function?.name || '',
                      input: {}
                    })
                    // Emit tool_start event
                    yield {
                      type: 'tool_start',
                      tool_call: {
                        id: tc.id || `call_${index}`,
                        name: tc.function?.name || '',
                        input: {}
                      }
                    }
                  } else {
                    // Update existing tool call (accumulate arguments)
                    const existing = toolCalls.get(index)
                    if (tc.function?.arguments) {
                      try {
                        // Try to parse accumulated arguments
                        const args = JSON.parse(tc.function.arguments)
                        existing.input = { ...existing.input, ...args }
                      } catch {
                        // Arguments still incomplete, ignore
                      }
                    }
                  }
                }
              }

              if (content) {
                yield {
                  content,
                  done: false
                }
              }
            } catch (parseError) {
              // Skip unparseable lines
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error, model: request.model }, 'DeepSeek stream failed')
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
      // Simple health check - verify we can reach the API
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })

      return {
        initialized: this.initialized,
        modelsAvailable: Object.keys(this.models).length,
        healthy: response.ok
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
