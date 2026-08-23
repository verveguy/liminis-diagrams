import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseC4, validateC4 } from '@liminis/diagrams/core'
import { C4InteractiveRenderer, C4ErrorDisplay } from '@liminis/diagrams/react'
import type { ManualLayout } from '@liminis/diagrams/core'
import { useIsDarkMode } from './useIsDarkMode'

/**
 * A live C4 editor, embedded in the documentation that explains it.
 *
 * This runs the *published* package — `@liminis/diagrams` is a real registry
 * dependency of the docs site, same as it is for the demo. So the diagram you
 * drag on a docs page is the code you get from `npm install`, not a preview of
 * unreleased source.
 *
 * Mounted with `client:only="react"` rather than `client:visible`: the drag
 * layer measures the live SVG through `getScreenCTM`, which does not exist
 * during a server render.
 */
export interface C4PlaygroundProps {
  /** Initial C4-PlantUML source. */
  source: string
  /** Start with drag enabled. */
  editable?: boolean
  /** Hide the source pane — for diagrams that illustrate rather than invite editing. */
  readOnly?: boolean
  /** Height of the diagram pane when inline, in CSS units. */
  height?: string
}

export default function C4Playground({
  source,
  editable = true,
  readOnly = false,
  height = '22rem',
}: C4PlaygroundProps) {
  const [text, setText] = useState(source.trim())
  const [positions, setPositions] = useState<ManualLayout['positions']>({})
  const [isEditMode, setIsEditMode] = useState(editable)
  const [isExpanded, setIsExpanded] = useState(false)
  const isDark = useIsDarkMode()

  // Escape closes; the page behind must not scroll while the lightbox is open.
  //
  // Expanding is a CSS overlay rather than the Fullscreen API on purpose: iOS
  // Safari implements `requestFullscreen` for video only, so the API is a no-op
  // on an iPad — a device this package's touch support exists for.
  useEffect(() => {
    if (!isExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [isExpanded])

  // Parse on every keystroke. The parser is pure and fast enough that
  // debouncing would add latency without buying anything.
  const parsed = useMemo(() => {
    const result = parseC4(text)
    if (result.diagram) result.errors.push(...validateC4(result.diagram))
    return result
  }, [text])

  const positionCount = Object.keys(positions).length
  const showSource = !readOnly || isExpanded

  const panel = (
    <div
      className={
        'c4-playground not-content' +
        (isExpanded ? ' c4-playground--expanded' : '') +
        (showSource ? '' : ' c4-playground--diagram-only')
      }
      role={isExpanded ? 'dialog' : undefined}
      aria-modal={isExpanded || undefined}
      aria-label={isExpanded ? 'C4 diagram, expanded' : undefined}
    >
      <div className="c4-playground__bar">
        <label>
          <input
            type="checkbox"
            checked={isEditMode}
            onChange={(e) => setIsEditMode(e.target.checked)}
          />{' '}
          Drag to reposition
        </label>
        <button type="button" onClick={() => setPositions({})} disabled={positionCount === 0}>
          Reset layout
        </button>
        <span className="c4-playground__hint">
          {positionCount > 0 ? `${positionCount} positions held in memory` : 'laid out by dagre'}
        </span>
        <button
          type="button"
          className="c4-playground__expand"
          onClick={() => setIsExpanded((v) => !v)}
          aria-pressed={isExpanded}
          title={isExpanded ? 'Close (Esc)' : 'Expand'}
        >
          {isExpanded ? '✕' : '⤡'}
        </button>
      </div>

      <div className="c4-playground__panes" style={{ minHeight: isExpanded ? undefined : height }}>
        {showSource && (
          <textarea
            className="c4-playground__source"
            value={text}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            aria-label="C4-PlantUML source"
          />
        )}
        <div className="c4-playground__canvas">
          {parsed.diagram && parsed.errors.length === 0 ? (
            <C4InteractiveRenderer
              diagram={parsed.diagram}
              isDarkMode={isDark}
              isEditMode={isEditMode}
              manualPositions={positions}
              onPositionChange={setPositions}
            />
          ) : (
            <C4ErrorDisplay errors={parsed.errors} isDarkMode={isDark} />
          )}
        </div>
      </div>
    </div>
  )

  if (!isExpanded) return panel

  // Portalled to <body> rather than rendered in place. `position: fixed` resolves
  // against the nearest ancestor with a transform, filter or containment rather
  // than the viewport, and z-index is confined to that ancestor's stacking
  // context — which is why the first attempt sat *under* Starlight's header and
  // table of contents no matter how high its z-index went. Escaping the content
  // tree is the fix; raising the number is not.
  //
  // The backdrop is a real element rather than a pseudo-element so clicking
  // outside closes. The panel is its sibling, not its child, so a click inside
  // the panel never reaches the backdrop's handler.
  return createPortal(
    <div className="c4-playground__lightbox">
      <div
        className="c4-playground__backdrop"
        onClick={() => setIsExpanded(false)}
        aria-hidden="true"
      />
      {panel}
    </div>,
    document.body,
  )
}
