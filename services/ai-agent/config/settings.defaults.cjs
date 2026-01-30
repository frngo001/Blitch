/**
 * AI-Agent Service Settings
 *
 * Default configuration for the AI-Agent service
 */

module.exports = {
  internal: {
    aiAgent: {
      port: parseInt(process.env.AI_AGENT_PORT, 10) || 3020,
      host: process.env.AI_AGENT_HOST || '0.0.0.0'
    }
  },

  // Internal service URLs for inter-service communication
  apis: {
    web: {
      url: process.env.WEB_API_URL || 'http://web:3000'
    },
    docstore: {
      url: process.env.DOCSTORE_URL || 'http://docstore:3016'
    },
    filestore: {
      url: process.env.FILESTORE_URL || 'http://filestore:3009'
    }
  },

  mongo: {
    url: process.env.MONGO_CONNECTION_STRING || 'mongodb://mongo:27017/sharelatex'
  },

  aiAgent: {
    // LLM Provider Configuration
    providers: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel: 'claude-3-5-haiku'
      },
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
        defaultModel: 'llama3.2'
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4o-mini'
      },
      google: {
        apiKey: process.env.GOOGLE_API_KEY,
        defaultModel: 'gemini-2.0-flash'
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        defaultModel: 'llama-3.3-70b-versatile'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        defaultModel: 'deepseek-chat'
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'deepseek/deepseek-chat'
      }
    },

    // Default provider and model
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'deepseek',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'deepseek-chat',

    // Rate limiting per tier (daily limits)
    rateLimits: {
      free: {
        requestsPerDay: 50,
        tokensPerDay: 50000,
        maxCostPerDay: 0.50
      },
      pro: {
        requestsPerDay: 500,
        tokensPerDay: 500000,
        maxCostPerDay: 5.00
      },
      team: {
        requestsPerDay: 1000,
        tokensPerDay: 1000000,
        maxCostPerDay: 10.00
      },
      enterprise: {
        requestsPerDay: -1, // Unlimited
        tokensPerDay: -1,
        maxCostPerDay: -1
      }
    },

    // Streaming configuration
    streaming: {
      enabled: true,
      keepAliveInterval: 15000 // 15 seconds
    },

    // Session configuration
    sessions: {
      maxMessagesPerSession: 100,
      maxSessionsPerUser: 50,
      sessionTimeoutDays: 30
    }
  }
}
