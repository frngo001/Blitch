/**
 * AI Chat Input
 *
 * Input field for sending messages to the AI agent
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import { AIMessage } from '../context/ai-chat-context'

type Props = {
  onSend: (content: string, context?: AIMessage['metadata']['document_context']) => void
  disabled?: boolean
}

export default function AIChatInput({ onSend, disabled }: Props) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [showContextMenu, setShowContextMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [content])

  const handleSubmit = () => {
    if (content.trim() && !disabled) {
      onSend(content.trim())
      setContent('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleAttachSelection = () => {
    // TODO: Implement selection attachment from editor
    setShowContextMenu(false)
  }

  return (
    <div className="ai-chat-input-container">
      <div className="ai-chat-input-wrapper">
        <button
          className="ai-chat-attach-button"
          onClick={() => setShowContextMenu(!showContextMenu)}
          title={t('attach_context') || 'Attach context'}
        >
          <MaterialIcon type="attach_file" />
        </button>

        {showContextMenu && (
          <div className="ai-chat-context-menu">
            <button onClick={handleAttachSelection}>
              <MaterialIcon type="text_select_start" />
              <span>{t('attach_selection') || 'Attach selection'}</span>
            </button>
            <button onClick={() => setShowContextMenu(false)}>
              <MaterialIcon type="description" />
              <span>{t('attach_document') || 'Attach document'}</span>
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="ai-chat-input"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('ask_ai_placeholder') || 'Ask the AI assistant...'}
          disabled={disabled}
          rows={1}
        />

        <button
          className="ai-chat-send-button"
          onClick={handleSubmit}
          disabled={!content.trim() || disabled}
          title={t('send')}
        >
          <MaterialIcon type="send" />
        </button>
      </div>

      <div className="ai-chat-input-hints">
        <span>{t('ai_chat_hint') || 'Press Enter to send, Shift+Enter for new line'}</span>
      </div>
    </div>
  )
}
