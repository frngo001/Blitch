/**
 * Diff Calculator
 *
 * Calculates differences between original and proposed content
 * Uses word-level diffing for better readability
 */

import type { DiffChange, DiffHighlight, DiffResult } from '../types/diff'

/**
 * Simple word-level diff implementation
 * For production, consider using 'diff' npm package
 */
function diffWords(oldStr: string, newStr: string): DiffChange[] {
  const oldWords = oldStr.split(/(\s+)/)
  const newWords = newStr.split(/(\s+)/)

  const changes: DiffChange[] = []

  // Simple LCS-based diff
  const matrix: number[][] = Array(oldWords.length + 1)
    .fill(null)
    .map(() => Array(newWords.length + 1).fill(0))

  // Build LCS matrix
  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1])
      }
    }
  }

  // Backtrack to find changes
  let i = oldWords.length
  let j = newWords.length
  const result: DiffChange[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'unchanged', value: oldWords[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      result.unshift({ type: 'addition', value: newWords[j - 1] })
      j--
    } else if (i > 0) {
      result.unshift({ type: 'deletion', value: oldWords[i - 1] })
      i--
    }
  }

  // Merge consecutive changes of the same type
  for (const change of result) {
    const last = changes[changes.length - 1]
    if (last && last.type === change.type) {
      last.value += change.value
    } else {
      changes.push({ ...change })
    }
  }

  return changes
}

/**
 * Calculate diff between original and proposed content
 */
export function calculateDiff(original: string, proposed: string): DiffResult {
  const changes = diffWords(original, proposed)

  // Calculate highlights with positions
  const highlights: DiffHighlight[] = []
  let position = 0

  for (const change of changes) {
    if (change.type === 'addition' || change.type === 'deletion') {
      highlights.push({
        type: change.type,
        from: position,
        to: position + change.value.length,
        text: change.value
      })
    }
    position += change.value.length
  }

  // Calculate stats
  const stats = {
    additions: changes.filter(c => c.type === 'addition').reduce((acc, c) => acc + c.value.length, 0),
    deletions: changes.filter(c => c.type === 'deletion').reduce((acc, c) => acc + c.value.length, 0),
    unchanged: changes.filter(c => c.type === 'unchanged').reduce((acc, c) => acc + c.value.length, 0)
  }

  return {
    originalContent: original,
    proposedContent: proposed,
    changes,
    highlights,
    stats
  }
}

/**
 * Format diff for display
 * Returns HTML-safe string with diff markers
 */
export function formatDiffHtml(changes: DiffChange[]): string {
  return changes
    .map(change => {
      const escaped = change.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      switch (change.type) {
        case 'addition':
          return `<span class="diff-addition">${escaped}</span>`
        case 'deletion':
          return `<span class="diff-deletion">${escaped}</span>`
        default:
          return escaped
      }
    })
    .join('')
}

/**
 * Get unified diff text
 */
export function getUnifiedDiff(original: string, proposed: string): string {
  const changes = diffWords(original, proposed)

  return changes
    .map(change => {
      switch (change.type) {
        case 'addition':
          return `+${change.value}`
        case 'deletion':
          return `-${change.value}`
        default:
          return change.value
      }
    })
    .join('')
}
