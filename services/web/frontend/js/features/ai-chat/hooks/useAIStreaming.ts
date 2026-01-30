/**
 * useAIStreaming Hook
 *
 * Hook for handling Server-Sent Events (SSE) streaming from AI Agent
 */

import { useState, useCallback, useRef, useEffect } from 'react'

type StreamingState = {
  isStreaming: boolean
  content: string
  error: Error | null
  usage: { input: number; output: number } | null
  sessionId: string | null
}

type StreamOptions = {
  projectId: string
  message: string
  sessionId?: string
  provider?: string
  model?: string
  context?: {
    doc_id?: string
    doc_name?: string
    selection?: {
      start_line: number
      end_line: number
      text: string
    }
  }
  onToken?: (content: string) => void
  onDone?: (fullContent: string, usage: { input: number; output: number }) => void
  onError?: (error: Error) => void
}

export function useAIStreaming() {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    error: null,
    usage: null,
    sessionId: null,
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming()
    }
  }, [])

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setState(prev => ({ ...prev, isStreaming: false }))
  }, [])

  const startStreaming = useCallback(async (options: StreamOptions) => {
    const {
      projectId,
      message,
      sessionId,
      provider,
      model,
      context,
      onToken,
      onDone,
      onError,
    } = options

    // Stop any existing stream
    stopStreaming()

    // Reset state
    setState({
      isStreaming: true,
      content: '',
      error: null,
      usage: null,
      sessionId: sessionId || null,
    })

    try {
      // Build URL with query parameters
      const params = new URLSearchParams()
      params.set('message', message)
      if (sessionId) params.set('sessionId', sessionId)
      if (provider) params.set('provider', provider)
      if (model) params.set('model', model)
      if (context) params.set('context', JSON.stringify(context))

      const url = `/project/${projectId}/agent/stream/proxy?${params.toString()}`

      // Create EventSource for SSE
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      let fullContent = ''

      eventSource.addEventListener('token', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (data.content) {
            fullContent += data.content
            setState(prev => ({ ...prev, content: fullContent }))
            onToken?.(data.content)
          }
        } catch (e) {
          console.error('Failed to parse token event:', e)
        }
      })

      eventSource.addEventListener('done', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const usage = data.tokens_used || { input: 0, output: 0 }

          setState(prev => ({
            ...prev,
            isStreaming: false,
            usage,
            sessionId: data.session_id || prev.sessionId,
          }))

          onDone?.(fullContent, usage)
          eventSource.close()
          eventSourceRef.current = null
        } catch (e) {
          console.error('Failed to parse done event:', e)
        }
      })

      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const data = JSON.parse((event as any).data || '{}')
          const error = new Error(data.error || 'Stream error')

          setState(prev => ({
            ...prev,
            isStreaming: false,
            error,
          }))

          onError?.(error)
          eventSource.close()
          eventSourceRef.current = null
        } catch (e) {
          // Connection error
          const error = new Error('Connection lost')
          setState(prev => ({
            ...prev,
            isStreaming: false,
            error,
          }))
          onError?.(error)
        }
      })

      eventSource.onerror = () => {
        // Generic error handler
        if (eventSource.readyState === EventSource.CLOSED) {
          setState(prev => {
            if (prev.isStreaming) {
              const error = new Error('Connection closed unexpectedly')
              onError?.(error)
              return { ...prev, isStreaming: false, error }
            }
            return prev
          })
        }
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start stream')
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: err,
      }))
      onError?.(err)
    }
  }, [stopStreaming])

  return {
    ...state,
    startStreaming,
    stopStreaming,
  }
}

/**
 * Alternative: Fetch-based streaming for browsers without EventSource support
 */
export function useAIStreamingFetch() {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    error: null,
    usage: null,
    sessionId: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setState(prev => ({ ...prev, isStreaming: false }))
  }, [])

  const startStreaming = useCallback(async (options: StreamOptions) => {
    const {
      projectId,
      message,
      sessionId,
      provider,
      model,
      context,
      onToken,
      onDone,
      onError,
    } = options

    stopStreaming()

    setState({
      isStreaming: true,
      content: '',
      error: null,
      usage: null,
      sessionId: sessionId || null,
    })

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const params = new URLSearchParams()
      params.set('message', message)
      if (sessionId) params.set('sessionId', sessionId)
      if (provider) params.set('provider', provider)
      if (model) params.set('model', model)
      if (context) params.set('context', JSON.stringify(context))

      const url = `/project/${projectId}/agent/stream/proxy?${params.toString()}`

      const response = await fetch(url, {
        signal: abortController.signal,
        headers: {
          'Accept': 'text/event-stream',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim()
            continue
          }

          if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (!data) continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.content && !parsed.done) {
                fullContent += parsed.content
                setState(prev => ({ ...prev, content: fullContent }))
                onToken?.(parsed.content)
              }

              if (parsed.done || parsed.tokens_used) {
                const usage = parsed.tokens_used || { input: 0, output: 0 }
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                  usage,
                  sessionId: parsed.session_id || prev.sessionId,
                }))
                onDone?.(fullContent, usage)
              }

              if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue
              throw e
            }
          }
        }
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return // User cancelled
      }

      const err = error instanceof Error ? error : new Error('Stream failed')
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: err,
      }))
      onError?.(err)
    }
  }, [stopStreaming])

  return {
    ...state,
    startStreaming,
    stopStreaming,
  }
}
