/**
 * Diff Preview Modal
 *
 * Shows a preview of changes before applying AI-generated content to the document.
 * Features:
 * - Side-by-side or unified diff view
 * - Color-coded additions (green) and deletions (red)
 * - Apply with or without Track Changes
 */

import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalHeader,
  OLModalTitle,
  OLModalBody,
  OLModalFooter,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { calculateDiff, formatDiffHtml } from '../utils/diff-calculator'
import type { DiffResult, ApplyOptions } from '../types/diff'

type DiffPreviewModalProps = {
  show: boolean
  onHide: () => void
  originalContent: string
  proposedContent: string
  onApply: (options: ApplyOptions) => void
  isApplying?: boolean
  selectionRange?: { from: number; to: number }
}

type ViewMode = 'unified' | 'split'

export function DiffPreviewModal({
  show,
  onHide,
  originalContent,
  proposedContent,
  onApply,
  isApplying = false,
  selectionRange
}: DiffPreviewModalProps) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('unified')

  const diff = useMemo(() => {
    return calculateDiff(originalContent, proposedContent)
  }, [originalContent, proposedContent])

  const handleApply = (withTrackChanges: boolean) => {
    onApply({
      mode: selectionRange ? 'replace' : 'insert',
      withTrackChanges,
      selectionRange
    })
  }

  return (
    <OLModal
      show={show}
      onHide={onHide}
      size="lg"
      className="diff-preview-modal"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>
          <MaterialIcon type="difference" />
          <span style={{ marginLeft: '8px' }}>
            {t('preview_changes', 'Preview Changes')}
          </span>
        </OLModalTitle>
        <div className="diff-view-mode-toggle">
          <button
            className={`diff-view-btn ${viewMode === 'unified' ? 'active' : ''}`}
            onClick={() => setViewMode('unified')}
            title={t('unified_view', 'Unified view')}
          >
            <MaterialIcon type="view_agenda" />
          </button>
          <button
            className={`diff-view-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title={t('split_view', 'Split view')}
          >
            <MaterialIcon type="view_column" />
          </button>
        </div>
      </OLModalHeader>

      <OLModalBody>
        {/* Stats */}
        <div className="diff-stats">
          <span className="diff-stat diff-stat-additions">
            <MaterialIcon type="add" />
            {diff.stats.additions} {t('chars_added', 'chars added')}
          </span>
          <span className="diff-stat diff-stat-deletions">
            <MaterialIcon type="remove" />
            {diff.stats.deletions} {t('chars_removed', 'chars removed')}
          </span>
        </div>

        {/* Diff Content */}
        {viewMode === 'unified' ? (
          <UnifiedDiffView diff={diff} />
        ) : (
          <SplitDiffView diff={diff} />
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={onHide} disabled={isApplying}>
          {t('cancel', 'Cancel')}
        </OLButton>
        <OLButton
          variant="secondary"
          onClick={() => handleApply(true)}
          disabled={isApplying}
        >
          <MaterialIcon type="track_changes" />
          <span style={{ marginLeft: '4px' }}>
            {t('apply_with_track_changes', 'Apply with Track Changes')}
          </span>
        </OLButton>
        <OLButton
          variant="primary"
          onClick={() => handleApply(false)}
          disabled={isApplying}
          isLoading={isApplying}
        >
          <MaterialIcon type="check" />
          <span style={{ marginLeft: '4px' }}>
            {t('apply', 'Apply')}
          </span>
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

// Unified Diff View Component
function UnifiedDiffView({ diff }: { diff: DiffResult }) {
  const htmlContent = useMemo(() => formatDiffHtml(diff.changes), [diff.changes])

  return (
    <div className="diff-unified-view">
      <pre
        className="diff-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  )
}

// Split Diff View Component
function SplitDiffView({ diff }: { diff: DiffResult }) {
  // Build original view (show deletions)
  const originalHtml = useMemo(() => {
    return diff.changes
      .filter(c => c.type !== 'addition')
      .map(c => {
        const escaped = c.value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

        if (c.type === 'deletion') {
          return `<span class="diff-deletion">${escaped}</span>`
        }
        return escaped
      })
      .join('')
  }, [diff.changes])

  // Build proposed view (show additions)
  const proposedHtml = useMemo(() => {
    return diff.changes
      .filter(c => c.type !== 'deletion')
      .map(c => {
        const escaped = c.value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

        if (c.type === 'addition') {
          return `<span class="diff-addition">${escaped}</span>`
        }
        return escaped
      })
      .join('')
  }, [diff.changes])

  return (
    <div className="diff-split-view">
      <div className="diff-split-pane">
        <div className="diff-split-header">
          <MaterialIcon type="description" />
          <span>Original</span>
        </div>
        <pre
          className="diff-content"
          dangerouslySetInnerHTML={{ __html: originalHtml }}
        />
      </div>
      <div className="diff-split-divider" />
      <div className="diff-split-pane">
        <div className="diff-split-header">
          <MaterialIcon type="auto_fix_high" />
          <span>Proposed</span>
        </div>
        <pre
          className="diff-content"
          dangerouslySetInnerHTML={{ __html: proposedHtml }}
        />
      </div>
    </div>
  )
}

export default DiffPreviewModal
