/**
 * useDiffPreview Hook
 *
 * Manages the diff preview modal state and integrates with the editor
 */

import { useState, useCallback } from 'react'
import { getGlobalEditorView } from '@/features/source-editor/extensions/expose-editor-view'
import type { ApplyOptions } from '../types/diff'

type UseDiffPreviewReturn = {
  showModal: boolean
  originalContent: string
  proposedContent: string
  selectionRange: { from: number; to: number } | null
  openDiffPreview: (proposedContent: string) => void
  closeDiffPreview: () => void
  applyChanges: (options: ApplyOptions) => void
  isApplying: boolean
}

export function useDiffPreview(): UseDiffPreviewReturn {
  const [showModal, setShowModal] = useState(false)
  const [originalContent, setOriginalContent] = useState('')
  const [proposedContent, setProposedContent] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  const openDiffPreview = useCallback((proposed: string) => {
    const view = getGlobalEditorView()
    if (!view) {
      console.warn('Editor view not available')
      return
    }

    const { from, to } = view.state.selection.main
    const hasSelection = from !== to

    // Get the original content (either selection or visible content)
    let original: string
    let range: { from: number; to: number } | null = null

    if (hasSelection) {
      original = view.state.sliceDoc(from, to)
      range = { from, to }
    } else {
      // No selection - use a reasonable portion of the document
      // This is a fallback; ideally the user selects what to replace
      const cursorPos = view.state.selection.main.head
      const lineStart = view.state.doc.lineAt(cursorPos).from
      const lineEnd = view.state.doc.lineAt(cursorPos).to
      original = view.state.sliceDoc(lineStart, lineEnd)
      range = { from: lineStart, to: lineEnd }
    }

    setOriginalContent(original)
    setProposedContent(cleanProposedContent(proposed))
    setSelectionRange(range)
    setShowModal(true)
  }, [])

  const closeDiffPreview = useCallback(() => {
    setShowModal(false)
    setOriginalContent('')
    setProposedContent('')
    setSelectionRange(null)
  }, [])

  const applyChanges = useCallback((options: ApplyOptions) => {
    const view = getGlobalEditorView()
    if (!view) {
      console.warn('Editor view not available')
      return
    }

    setIsApplying(true)

    try {
      const { from, to } = options.selectionRange || { from: 0, to: 0 }

      // Apply the proposed content
      view.dispatch({
        changes: { from, to, insert: proposedContent },
        annotations: [
          // Mark this as an AI-generated change
          // This could be used by Track Changes
        ]
      })

      // If track changes is requested, emit an event for the editor to handle
      if (options.withTrackChanges) {
        window.dispatchEvent(new CustomEvent('ai-apply-with-track-changes', {
          detail: {
            from,
            to,
            content: proposedContent
          }
        }))
      }

      closeDiffPreview()
    } catch (error) {
      console.error('Failed to apply changes:', error)
    } finally {
      setIsApplying(false)
    }
  }, [proposedContent, closeDiffPreview])

  return {
    showModal,
    originalContent,
    proposedContent,
    selectionRange,
    openDiffPreview,
    closeDiffPreview,
    applyChanges,
    isApplying
  }
}

/**
 * Clean proposed content by removing markdown code blocks and extra whitespace
 */
function cleanProposedContent(content: string): string {
  let cleaned = content

  // Remove markdown code block markers
  // Matches: ```latex, ```tex, ```, etc.
  cleaned = cleaned.replace(/^```(?:latex|tex|[\w]*)\n?/gm, '')
  cleaned = cleaned.replace(/\n?```$/gm, '')

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim()

  return cleaned
}

export default useDiffPreview
