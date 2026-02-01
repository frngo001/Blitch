/**
 * Chat History Modal
 *
 * Modal component for viewing and managing past chat sessions.
 * Features:
 * - List past sessions with title, date, and message count
 * - Search/filter sessions
 * - Load previous sessions
 * - Delete sessions
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalHeader,
  OLModalTitle,
  OLModalBody,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { getJSON, deleteJSON } from '@/infrastructure/fetch-json'

type ChatSession = {
  _id: string
  title: string
  message_count: number
  created_at: string
  updated_at: string
  model_preference?: {
    provider: string
    model: string
  }
  status: 'active' | 'archived'
}

type ChatHistoryModalProps = {
  show: boolean
  onHide: () => void
  onLoadSession: (sessionId: string) => void
  projectId: string
  currentSessionId?: string | null
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

export function ChatHistoryModal({
  show,
  onHide,
  onLoadSession,
  projectId,
  currentSessionId
}: ChatHistoryModalProps) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    if (!projectId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await getJSON(`/project/${projectId}/agent/sessions`)
      setSessions(response.sessions || [])
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setError('Failed to load chat history')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (show) {
      loadSessions()
    }
  }, [show, loadSessions])

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (sessionId === currentSessionId) {
      // Can't delete current session
      return
    }

    setDeletingId(sessionId)
    setError(null)

    try {
      await deleteJSON(`/project/${projectId}/agent/session?sessionId=${sessionId}`)
      setSessions(prev => prev.filter(s => s._id !== sessionId))
    } catch (err) {
      console.error('Failed to delete session:', err)
      setError('Failed to delete session')
    } finally {
      setDeletingId(null)
    }
  }

  const handleLoadSession = (sessionId: string) => {
    if (sessionId === currentSessionId) {
      // Already loaded
      onHide()
      return
    }
    onLoadSession(sessionId)
    onHide()
  }

  const filteredSessions = sessions.filter(session => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return session.title?.toLowerCase().includes(query)
  })

  const getModelBadge = (session: ChatSession) => {
    if (!session.model_preference?.model) return null
    const model = session.model_preference.model
    // Shorten model names
    if (model.includes('deepseek')) return 'DS'
    if (model.includes('claude')) return 'CL'
    if (model.includes('llama')) return 'LL'
    return model.substring(0, 2).toUpperCase()
  }

  return (
    <OLModal show={show} onHide={onHide} size="lg" className="chat-history-modal">
      <OLModalHeader closeButton>
        <OLModalTitle>
          <MaterialIcon type="forum" />
          <span style={{ marginLeft: '8px' }}>
            {t('chat_history', 'Chat History')}
          </span>
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {/* Search */}
        <div className="chat-history-search">
          <MaterialIcon type="search" />
          <input
            type="text"
            placeholder={t('search_sessions', 'Search sessions...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="chat-history-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <MaterialIcon type="close" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="chat-history-error">
            <MaterialIcon type="error" />
            <span>{error}</span>
            <button onClick={loadSessions}>
              <MaterialIcon type="refresh" />
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="chat-history-loading">
            <MaterialIcon type="sync" className="spin" />
            <span>{t('loading', 'Loading...')}</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="chat-history-empty">
            <MaterialIcon type="chat_bubble_outline" />
            <p>
              {searchQuery
                ? t('no_matching_sessions', 'No matching sessions')
                : t('no_chat_history', 'No chat history yet')}
            </p>
            {searchQuery && (
              <OLButton variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                {t('clear_search', 'Clear search')}
              </OLButton>
            )}
          </div>
        ) : (
          <div className="chat-history-list">
            {filteredSessions.map(session => (
              <div
                key={session._id}
                className={`chat-history-item ${session._id === currentSessionId ? 'current' : ''}`}
                onClick={() => handleLoadSession(session._id)}
              >
                <div className="chat-history-item-content">
                  <div className="chat-history-item-title">
                    {session.title || t('untitled_session', 'Untitled Session')}
                    {session._id === currentSessionId && (
                      <span className="chat-history-current-badge">
                        {t('current', 'Current')}
                      </span>
                    )}
                  </div>
                  <div className="chat-history-item-meta">
                    <span className="chat-history-item-date">
                      <MaterialIcon type="schedule" />
                      {formatRelativeTime(session.updated_at)}
                    </span>
                    <span className="chat-history-item-messages">
                      <MaterialIcon type="chat" />
                      {session.message_count || 0}
                    </span>
                    {getModelBadge(session) && (
                      <span className="chat-history-item-model">
                        {getModelBadge(session)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="chat-history-item-actions">
                  {session._id !== currentSessionId && (
                    <button
                      className="chat-history-delete-btn"
                      onClick={(e) => handleDelete(session._id, e)}
                      disabled={deletingId === session._id}
                      title={t('delete_session', 'Delete session')}
                    >
                      <MaterialIcon
                        type={deletingId === session._id ? 'sync' : 'delete'}
                        className={deletingId === session._id ? 'spin' : ''}
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer with count */}
        {!isLoading && filteredSessions.length > 0 && (
          <div className="chat-history-footer">
            <span>
              {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
          </div>
        )}
      </OLModalBody>
    </OLModal>
  )
}

export default ChatHistoryModal
