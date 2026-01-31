/**
 * Floating Chat Input
 *
 * A modern, floating input component for the AI Chat
 * Exact 1-1 implementation of the provided design
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'

type Props = {
    onSend: (content: string) => void
    onQuickAction?: (action: string) => void
    disabled?: boolean
    isStreaming?: boolean
    onStop?: () => void
    contextName?: string
    contextDescription?: string
}

const COMMANDS = [
    { id: 'explain', label: 'Explain', icon: 'lightbulb' },
    { id: 'analyze', label: 'Analyze', icon: 'search' },
    { id: 'summarize', label: 'Summarize', icon: 'segment' },
]

export default function FloatingChatInput({
    onSend,
    onQuickAction,
    disabled,
    isStreaming,
    onStop,
    contextName = 'renewed-nature',
    contextDescription = 'railway.com'
}: Props) {
    const { t } = useTranslation()
    const [content, setContent] = useState('')
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
        }
    }, [content])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        setContent(val)

        // Simple slash detection (starts with /)
        // A robust implementation would check cursor position
        if (val === '/') {
            setShowSlashMenu(true)
        } else if (!val.startsWith('/')) {
            setShowSlashMenu(false)
        }
    }

    const handleSlashCommand = (cmdId: string) => {
        onQuickAction?.(cmdId)
        setShowSlashMenu(false)
        setContent('') // Clear slash
    }

    const handleSubmit = () => {
        if (content.trim() && !disabled) {
            onSend(content.trim())
            setContent('')
            setShowSlashMenu(false)
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }

        if (e.key === 'Escape') {
            setShowSlashMenu(false)
        }
    }

    return (
        <div className="floating-input-container">
            {/* Slash Command Menu (Floating above input) */}
            {showSlashMenu && (
                <div className="slash-command-menu">
                    <div className="slash-menu-header">Quick Actions</div>
                    {COMMANDS.map(cmd => (
                        <button
                            key={cmd.id}
                            className="slash-cmd-item"
                            onClick={() => handleSlashCommand(cmd.id)}
                        >
                            <div className="cmd-icon">
                                <MaterialIcon type={cmd.icon} />
                            </div>
                            <div className="cmd-info">
                                <span className="cmd-label">{t(cmd.id, cmd.label)}</span>
                                <span className="cmd-hint">/{cmd.id}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Quick Action Pills */}
            <div className="floating-input-pills">
                {COMMANDS.map(cmd => (
                    <button
                        key={cmd.id}
                        className="quick-action-pill"
                        onClick={() => handleSlashCommand(cmd.id)}
                    >
                        <MaterialIcon type={cmd.icon} />
                        <span>{t(cmd.id, cmd.label)}</span>
                    </button>
                ))}
            </div>

            {/* Main Input Box */}
            <div className="floating-input-box">
                {/* Context Pill - Inside Box, Top Left */}
                {contextName && (
                    <div className="input-context-pill">
                        <div className="context-icon">
                            {/* Simple planet/globe icon styling */}
                            <MaterialIcon type="public" />
                        </div>
                        <div className="context-info">
                            <span className="context-name">{contextName}</span>
                            <span className="context-desc">{contextDescription}</span>
                        </div>
                    </div>
                )}

                {/* Text Area */}
                <textarea
                    ref={textareaRef}
                    className="floating-textarea"
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={t('ask_question_placeholder', 'Ask a question about this page...')}
                    disabled={disabled}
                    rows={1}
                />

                {/* Bottom Toolbar */}
                <div className="floating-input-toolbar">
                    <div className="toolbar-left">
                        <button className="toolbar-btn" disabled={disabled} title={t('add')}>
                            <MaterialIcon type="add" />
                        </button>
                        <button className="toolbar-btn" disabled={disabled} title={t('more')}>
                            <MaterialIcon type="more_horiz" />
                        </button>
                    </div>

                    <div className="toolbar-right">
                        <button className="toolbar-btn" disabled={disabled} title={t('camera')}>
                            <MaterialIcon type="photo_camera" />
                        </button>
                        <button className="toolbar-btn" disabled={disabled} title={t('voice')}>
                            <MaterialIcon type="mic" />
                        </button>

                        {isStreaming ? (
                            <button className="send-btn stop" onClick={onStop}>
                                <MaterialIcon type="stop" />
                            </button>
                        ) : (
                            <button
                                className="send-btn"
                                onClick={handleSubmit}
                                disabled={!content.trim() || disabled}
                            >
                                <MaterialIcon type="arrow_upward" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
