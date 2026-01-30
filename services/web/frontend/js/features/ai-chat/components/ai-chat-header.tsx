/**
 * AI Chat Header
 *
 * Header with model selector, settings, and close button
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChatContext } from '../context/ai-chat-context'
import MaterialIcon from '@/shared/components/material-icon'

type Props = {
  onClose: () => void
}

// Available models (simplified list)
const MODELS = {
  anthropic: [
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', tier: 'free' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tier: 'pro' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', tier: 'pro' },
    { id: 'claude-opus-4', name: 'Claude Opus 4', tier: 'enterprise' },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2', tier: 'free' },
    { id: 'mistral', name: 'Mistral 7B', tier: 'free' },
    { id: 'qwen2.5', name: 'Qwen 2.5', tier: 'free' },
  ],
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'ollama', name: 'Ollama (Local)' },
]

export default function AIChatHeader({ onClose }: Props) {
  const { t } = useTranslation()
  const [showModelSelector, setShowModelSelector] = useState(false)

  const {
    selectedProvider,
    selectedModel,
    setProvider,
    setModel,
    clearSession,
  } = useAIChatContext()

  const currentModel = MODELS[selectedProvider as keyof typeof MODELS]?.find(
    m => m.id === selectedModel
  )

  const handleProviderChange = (provider: string) => {
    setProvider(provider)
    // Set default model for provider
    const models = MODELS[provider as keyof typeof MODELS]
    if (models && models.length > 0) {
      setModel(models[0].id)
    }
    setShowModelSelector(false)
  }

  const handleModelChange = (model: string) => {
    setModel(model)
    setShowModelSelector(false)
  }

  const handleNewChat = () => {
    clearSession()
  }

  return (
    <header className="ai-chat-header">
      <div className="ai-chat-header-left">
        <MaterialIcon type="smart_toy" className="ai-chat-icon" />
        <span className="ai-chat-title">{t('ai_assistant')}</span>
      </div>

      <div className="ai-chat-header-center">
        <button
          className="ai-chat-model-selector"
          onClick={() => setShowModelSelector(!showModelSelector)}
        >
          <span>{currentModel?.name || selectedModel}</span>
          <MaterialIcon type="expand_more" />
        </button>

        {showModelSelector && (
          <div className="ai-chat-model-dropdown">
            {PROVIDERS.map(provider => (
              <div key={provider.id} className="ai-chat-provider-group">
                <div className="ai-chat-provider-label">{provider.name}</div>
                {MODELS[provider.id as keyof typeof MODELS]?.map(model => (
                  <button
                    key={model.id}
                    className={`ai-chat-model-option ${
                      selectedProvider === provider.id && selectedModel === model.id
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() => {
                      handleProviderChange(provider.id)
                      handleModelChange(model.id)
                    }}
                  >
                    <span>{model.name}</span>
                    {model.tier !== 'free' && (
                      <span className="ai-chat-tier-badge">{model.tier}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ai-chat-header-right">
        <button
          className="ai-chat-header-button"
          onClick={handleNewChat}
          title={t('new_chat') || 'New chat'}
        >
          <MaterialIcon type="add" />
        </button>
        <button
          className="ai-chat-header-button"
          onClick={onClose}
          title={t('close')}
        >
          <MaterialIcon type="close" />
        </button>
      </div>
    </header>
  )
}
