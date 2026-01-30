/**
 * Diff Types for AI Chat Apply Preview
 */

export type DiffChangeType = 'addition' | 'deletion' | 'unchanged'

export type DiffChange = {
  type: DiffChangeType
  value: string
  count?: number
}

export type DiffHighlight = {
  type: 'addition' | 'deletion'
  from: number
  to: number
  text: string
}

export type DiffResult = {
  originalContent: string
  proposedContent: string
  changes: DiffChange[]
  highlights: DiffHighlight[]
  stats: {
    additions: number
    deletions: number
    unchanged: number
  }
}

export type ApplyMode = 'replace' | 'insert' | 'append'

export type ApplyOptions = {
  mode: ApplyMode
  withTrackChanges: boolean
  selectionRange?: { from: number; to: number }
}
