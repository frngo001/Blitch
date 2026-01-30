/**
 * Markdown Renderer Component
 *
 * Renders markdown content with:
 * - Syntax highlighting for code blocks (Prism)
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - Copy code button
 * - Safe rendering (no dangerouslySetInnerHTML)
 */

import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

type MarkdownRendererProps = {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const components: Components = {
    code({ node, className: codeClassName, children, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || '')
      const language = match ? match[1] : ''
      const isInline = !match && !String(children).includes('\n')

      if (isInline) {
        return (
          <code className="md-inline-code" {...props}>
            {children}
          </code>
        )
      }

      return (
        <CodeBlock language={language || 'text'}>
          {String(children).replace(/\n$/, '')}
        </CodeBlock>
      )
    },
    // Style tables
    table({ children }) {
      return <table className="md-table">{children}</table>
    },
    // Style blockquotes
    blockquote({ children }) {
      return <blockquote className="md-blockquote">{children}</blockquote>
    },
    // Style links - open in new tab
    a({ href, children }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
          {children}
        </a>
      )
    },
    // Style lists
    ul({ children }) {
      return <ul className="md-list md-ul">{children}</ul>
    },
    ol({ children }) {
      return <ol className="md-list md-ol">{children}</ol>
    },
    // Style headings
    h1({ children }) {
      return <h1 className="md-heading md-h1">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="md-heading md-h2">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="md-heading md-h3">{children}</h3>
    },
    h4({ children }) {
      return <h4 className="md-heading md-h4">{children}</h4>
    },
    // Style paragraphs
    p({ children }) {
      return <p className="md-paragraph">{children}</p>
    },
    // Style horizontal rules
    hr() {
      return <hr className="md-hr" />
    },
    // Style strong/bold
    strong({ children }) {
      return <strong className="md-strong">{children}</strong>
    },
    // Style emphasis/italic
    em({ children }) {
      return <em className="md-em">{children}</em>
    },
  }

  return (
    <div className={`markdown-renderer ${className || ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

// Code Block with copy button and syntax highlighting
function CodeBlock({
  language,
  children,
}: {
  language: string
  children: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [children])

  // Map common language aliases
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    sh: 'bash',
    yml: 'yaml',
    tex: 'latex',
    md: 'markdown',
  }

  const normalizedLang = languageMap[language] || language

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{language}</span>
        <button
          className="md-code-copy"
          onClick={handleCopy}
          title="Copy to clipboard"
          type="button"
        >
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            <>
              <CopyIcon /> Copy
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={normalizedLang}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '13px',
          padding: '12px 16px',
        }}
        codeTagProps={{
          style: {
            fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
          },
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

// Simple SVG icons
function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default MarkdownRenderer
