/**
 * AI Chat Pane
 *
 * Main component for the AI Scientific Agent Chat
 * IMPORTANT: This is SEPARATE from the team chat (features/chat)
 */

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChatContext } from '../context/ai-chat-context'
import AIChatHeader from './ai-chat-header'
import AIChatMessages from './ai-chat-messages'
import FloatingChatInput from './floating-chat-input'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'

const Loading = () => <FullSizeLoadingSpinner delay={500} className="pt-4" />

export default function AIChatPane() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const {
    status,
    messages,
    currentStreamContent,
    error,
    loadSession,
    sendMessage,
  } = useAIChatContext()

  useEffect(() => {
    if (isOpen) {
      loadSession()
    }
  }, [isOpen, loadSession])

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  if (!isOpen) {
    return (
      <button
        className="ai-chat-toggle-button"
        onClick={handleToggle}
        aria-label={t('ai_assistant')}
        title={t('ai_assistant')}
      >
        <MaterialIcon type="smart_toy" />
      </button>
    )
  }

  return (
    <aside className="ai-chat-pane" aria-label={t('ai_assistant')}>
      <AIChatHeader onClose={handleToggle} />

      <div className="ai-chat-messages-container">
        {status === 'pending' && messages.length === 0 && <Loading />}

        {error && (
          <div className="ai-chat-error">
            <MaterialIcon type="error" />
            <span>{error.message || t('ai_chat_error')}</span>
          </div>
        )}

        {messages.length === 0 && status === 'idle' && (
          <AIChatPlaceholder />
        )}

        <AIChatMessages
          messages={messages}
          streamingContent={currentStreamContent}
          isStreaming={status === 'streaming'}
        />
      </div>

      <FloatingChatInput
        onSend={(content) => sendMessage(content)}
        // If we have Context support in context, we pass it here
        isStreaming={status === 'streaming'}
        onStop={() => { /* Implement stop logic if available or in context */ }}
        disabled={status === 'pending' || status === 'streaming'}
        onQuickAction={(action) => sendMessage(action)}
      />
    </aside>
  )
}

function AIChatPlaceholder() {
  const { t } = useTranslation()

  return (
    <div className="ai-chat-placeholder">
      <div className="ai-chat-placeholder-icon">
        <MaterialIcon type="smart_toy" />
      </div>
      <h3>{t('ai_assistant')}</h3>
      <p>{t('ai_assistant_description') || 'Ask me to help with your scientific writing, LaTeX formatting, or research questions.'}</p>
      {/* Quick actions are now in the input component */}
    </div>
  )
}
