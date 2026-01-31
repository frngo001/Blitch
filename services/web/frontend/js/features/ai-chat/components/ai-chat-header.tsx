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
  const { clearSession } = useAIChatContext()

  return (
    <header className="ai-chat-header">
      <div className="ai-chat-header-left">
        <button
          className="ai-chat-header-button"
          onClick={clearSession} // Assuming edit/new chat
          title={t('new_chat')}
        >
          <MaterialIcon type="edit_square" />
        </button>
      </div>

      {/* Center is empty in the design */}
      <div className="ai-chat-header-center" />

      <div className="ai-chat-header-right">
        <button className="ai-chat-header-button" title="Script">
          <MaterialIcon type="history" />
        </button>
        <button className="ai-chat-header-button" title="Sidebar">
          <MaterialIcon type="view_sidebar" />
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
