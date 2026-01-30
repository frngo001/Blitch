/**
 * Ollama Adapter
 *
 * Adapter for local Ollama models (Llama, Mistral, Qwen, DeepSeek, etc.)
 * No API key required - runs locally
 */

import logger from '@overleaf/logger'
import { BaseAdapter } from './BaseAdapter.js'

export class OllamaAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.baseUrl = config.baseUrl || 'http://localhost:11434'

    // Available local models (dynamically discovered)
    this.models = {
      'llama3.2': {
        name: 'Llama 3.2',
        maxTokens: 128000,
        pricing: { input: 0, output: 0 }, // Free (local)
        tier: 'free',
        description: 'Meta Llama 3.2 - general purpose'
      },
      'llama3.2:1b': {
        name: 'Llama 3.2 1B',
        maxTokens: 128000,
        pricing: { input: 0, output: 0 },
        tier: 'free',
        description: 'Lightweight Llama 3.2'
      },
      'mistral': {
        name: 'Mistral 7B',
        maxTokens: 32000,
        pricing: { input: 0, output: 0 },
        tier: 'free',
        description: 'Mistral AI - fast and capable'
      },
      'qwen2.5': {
        name: 'Qwen 2.5',
        maxTokens: 32000,
        pricing: { input: 0, output: 0 },
        tier: 'free',
        description: 'Alibaba Qwen - multilingual'
      },
      'deepseek-coder': {
        name: 'DeepSeek Coder',
        maxTokens: 128000,
        pricing: { input: 0, output: 0 },
        tier: 'free',
        description: 'Specialized for code'
      },
      'codellama': {
        name: 'Code Llama',
        maxTokens: 100000,
        pricing: { input: 0, output: 0 },
        tier: 'free',
        description: 'Meta Code Llama'
      }
    }
  }

  async initialize() {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (response.ok) {
        const data = await response.json()

        // Update available models based on what's actually installed
        if (data.models && data.models.length > 0) {
          for (const model of data.models) {
            const name = model.name.split(':')[0]
            if (!this.models[name]) {
              this.models[name] = {
                name: model.name,
                maxTokens: 32000, // Default
                pricing: { input: 0, output: 0 },
                tier: 'free',
                description: `Locally installed: ${model.name}`
              }
            }
          }
          logger.info({ models: data.models.map(m => m.name) }, 'Ollama models discovered')
        }

        this.initialized = true
        logger.info({ baseUrl: this.baseUrl }, 'Ollama adapter initialized')
      } else {
        throw new Error(`Ollama not responding: ${response.status}`)
      }
    } catch (error) {
      // Ollama might not be running - that's okay, mark as partially initialized
      logger.warn({ error, baseUrl: this.baseUrl }, 'Ollama not available')
      this.initialized = false
    }
  }

  normalizeRequest(request) {
    return {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens || request.max_tokens || 4096
      },
      stream: request.stream || false
    }
  }

  async complete(request) {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          options: request.options,
          stream: false
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama error: ${error}`)
      }

      const data = await response.json()

      return {
        id: `ollama-${Date.now()}`,
        content: data.message?.content || '',
        model: request.model,
        usage: {
          input_tokens: data.prompt_eval_count || 0,
          output_tokens: data.eval_count || 0
        },
        stop_reason: 'stop'
      }
    } catch (error) {
      logger.error({ error, model: request.model }, 'Ollama completion failed')
      throw error
    }
  }

  async *stream(request) {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          options: request.options,
          stream: true
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama error: ${error}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      let totalUsage = { prompt_eval_count: 0, eval_count: 0 }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          yield {
            content: '',
            done: true,
            usage: {
              input: totalUsage.prompt_eval_count,
              output: totalUsage.eval_count
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line)

              if (data.done) {
                totalUsage = {
                  prompt_eval_count: data.prompt_eval_count || 0,
                  eval_count: data.eval_count || 0
                }
              } else if (data.message?.content) {
                yield {
                  content: data.message.content,
                  done: false
                }
              }
            } catch (parseError) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error, model: request.model }, 'Ollama stream failed')
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
      const response = await fetch(`${this.baseUrl}/api/tags`)
      const healthy = response.ok

      return {
        initialized: this.initialized,
        modelsAvailable: Object.keys(this.models).length,
        healthy,
        baseUrl: this.baseUrl
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

  /**
   * Pull a model if not already available
   * @param {string} modelName - Model to pull
   */
  async pullModel(modelName) {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      })

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`)
      }

      logger.info({ model: modelName }, 'Model pull started')
      return true
    } catch (error) {
      logger.error({ error, model: modelName }, 'Failed to pull model')
      throw error
    }
  }

  get name() {
    return 'ollama'
  }
}
