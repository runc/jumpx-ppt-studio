import React from 'react'

export const AIARTIFACTS_SITE = 'https://aiartifacts.art/slidestudio'

const BRAND_NAME = 'Slide Studio'

const EXT = (
  <svg
    className="brand-ext"
    viewBox="0 0 24 24"
    width="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    aria-hidden="true"
  >
    <path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
  </svg>
)

function BrandGlyph({ size = 'md' }: { size?: 'md' | 'sm' }) {
  return (
    <span className={'brand-glyph' + (size === 'sm' ? ' sm' : '')} aria-hidden="true">
      SS
    </span>
  )
}

export function BrandLink({
  sub = '',
  compact = false,
  onDark = false,
  className = '',
}: {
  sub?: string
  compact?: boolean
  onDark?: boolean
  className?: string
}) {
  const cls = 'brand-link' + (onDark ? ' on-dark' : '') + (className ? ' ' + className : '')
  return (
    <a
      className={cls}
      href={AIARTIFACTS_SITE}
      target="_blank"
      rel="noopener noreferrer"
      title="访问 Slide Studio ↗"
      aria-label="Slide Studio · 访问官网"
    >
      <BrandGlyph />
      {!compact && (
        <span className="brand-word">
          {BRAND_NAME}
          {sub && <span className="brand-sub">/ {sub}</span>}
        </span>
      )}
      {EXT}
    </a>
  )
}

export function BrandMark({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  const cls = 'brand-mark-static' + (onDark ? ' on-dark' : '') + (className ? ' ' + className : '')
  return (
    <span className={cls} aria-label={BRAND_NAME}>
      <BrandGlyph size="sm" />
      <span className="brand-word">{BRAND_NAME}</span>
    </span>
  )
}
