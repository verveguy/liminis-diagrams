import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  /**
   * Whether the reader may drag nodes. `false` is a fixed illustration: drag is
   * off and there is no control to turn it on. Anything else starts with drag
   * enabled and offers the toggle.
   */
  editable?: boolean
  /** Hide the source pane — for diagrams that illustrate rather than invite editing. */
  readOnly?: boolean
  /** Height of the diagram pane when inline, in CSS units. */
  height?: string
}

/**
 * Zoom steps, rather than a continuous factor.
 *
 * A diagram is not a photograph: there is a size at which its labels are legible
 * and sizes either side of it that are not, so the useful range is small and
 * discrete. Steps also keep the control to two buttons and a readout, which is
 * the entire UI anyone needs here.
 */
/**
 * Zoom steps, as multiples of the fitted size.
 *
 * 100% is the view that shows the whole diagram, not 1 SVG unit per pixel.
 * That is the size the reader arrives at, so it is the one the number should
 * describe — and it keeps the readout still when the lightbox opens, where the
 * diagram is drawn larger but is still, conceptually, the same whole-diagram
 * view. Reporting absolute scale made expanding look like a zoom: 57% became
 * 100% while nothing about what you could see had changed.
 *
 * The range starts at fit because there is nothing below it worth seeing. Once
 * the whole diagram is visible, smaller only buys whitespace.
 */
const ZOOM_STEPS = [1, 1.5, 2, 3, 4]

/**
 * The scale at which the whole diagram is visible in the pane it is given.
 *
 * Never above 1. A diagram larger than its pane should shrink to fit, but a
 * small one blown up to fill a lightbox is a surprise: nothing was gained and
 * the reader now has to work out what the size means. Fitting is about seeing
 * all of it, not about filling space.
 *
 * Returns null when there is nothing to measure yet — before hydration, or if
 * the pane has no size because it is display:none.
 */
function fitScale(canvas: HTMLElement | null): number | null {
  const svg = canvas?.querySelector('svg')
  if (!canvas || !svg) return null

  const { width: diagramWidth, height: diagramHeight } = svg.viewBox.baseVal
  if (!diagramWidth || !diagramHeight) return null

  // The pane's usable space, less its own padding — measuring the border box
  // would overshoot by the padding and clip what fitting is meant to reveal.
  const style = getComputedStyle(canvas)
  const available = {
    width: canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    height: canvas.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
  }
  if (available.width <= 0 || available.height <= 0) return null

  return Math.min(1, available.width / diagramWidth, available.height / diagramHeight)
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
  // Zoom as a multiple of the fitted size: 1 is "the whole diagram", which is
  // where every view starts. The absolute scale handed to the renderer is this
  // times whatever fitting currently works out to.
  const [relativeZoom, setRelativeZoom] = useState(1)
  const [fittedZoom, setFittedZoom] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)
  const isDark = useIsDarkMode()
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusTo = useRef<Element | null>(null)

  // Escape closes; the page behind must not scroll while the lightbox is open.
  //
  // Expanding is a CSS overlay rather than the Fullscreen API on purpose: iOS
  // Safari implements `requestFullscreen` for video only, so the API is a no-op
  // on an iPad — a device this package's touch support exists for.
  useEffect(() => {
    if (!isExpanded) return

    // Where focus came from, so closing puts it back rather than dumping the
    // reader at the top of the document.
    returnFocusTo.current = document.activeElement
    const panel = panelRef.current
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled'))

    focusable()[0]?.focus()

    // `aria-modal` promises the rest of the page is unreachable, and a promise
    // the markup does not keep is worse than not making it: a keyboard user
    // tabs into content hidden behind the backdrop with no way to tell where
    // they are. Tab is cycled within the panel to make it true.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false)
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      // Focus can be outside the panel entirely — the browser's own UI hands it
      // back to the document, an extension moves it. Both directions have to
      // catch that case, or Tab walks into the page behind the backdrop, which
      // is exactly what aria-modal promises cannot happen.
      const active = document.activeElement
      const escaped = !panel?.contains(active)
      if (e.shiftKey && (escaped || active === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (escaped || active === last)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      // Guarded: the element may have been unmounted while the panel was open.
      const target = returnFocusTo.current
      if (target instanceof HTMLElement && target.isConnected) target.focus()
    }
  }, [isExpanded])

  // Parse on every keystroke. The parser is pure and fast enough that
  // debouncing would add latency without buying anything.
  const parsed = useMemo(() => {
    const result = parseC4(text)
    if (result.diagram) result.errors.push(...validateC4(result.diagram))
    return result
  }, [text])

  // What the renderer is actually given. Fitting produces an arbitrary scale —
  // 0.57 on this site's architecture page — and the reader's multiple applies
  // on top of it.
  const zoom = fittedZoom * relativeZoom

  const stepZoom = useCallback((direction: 1 | -1) => {
    setRelativeZoom((current) => {
      const next =
        direction === 1
          ? ZOOM_STEPS.find((step) => step > current + 0.001)
          : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001)
      return next ?? current
    })
  }, [])

  // Declared before the effect below, which depends on it: the source pane's
  // presence changes how much width the diagram has to fit into.
  const showSource = !readOnly

  // Measure after layout rather than after paint, so the diagram is never shown
  // at the wrong size for a frame and then corrected — which reads as a flinch.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const measure = () => {
      const fit = fitScale(canvas)
      if (fit !== null) setFittedZoom(fit)
    }
    measure()

    // The pane resizes when the window does, when the lightbox opens, and when
    // the source pane is shown or hidden. Observing it covers all three without
    // enumerating them.
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
    // `text` is a dependency because editing the source changes the diagram's
    // dimensions, and `isExpanded` because the pane it has to fit changes.
  }, [text, isExpanded, showSource])

  // Expanding is a request to see the whole diagram, so it returns to fitting
  // even if the reader had zoomed in beforehand. Collapsing does the same, since
  // the inline pane is a different size again.
  useEffect(() => {
    setRelativeZoom(1)
  }, [isExpanded])

  const positionCount = Object.keys(positions).length

  const panel = (
    <div
      ref={panelRef}
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
        {/* No toggle at all when the diagram is declared non-editable. Leaving
            an enabled checkbox beside a "static" diagram let the reader switch
            dragging back on, so the fence meta described something the
            component did not enforce. */}
        {editable && (
          <label>
            <input
              type="checkbox"
              checked={isEditMode}
              onChange={(e) => setIsEditMode(e.target.checked)}
            />{' '}
            Drag to reposition
          </label>
        )}
        {editable && (
          <button type="button" onClick={() => setPositions({})} disabled={positionCount === 0}>
            Reset layout
          </button>
        )}
        <span className="c4-playground__hint">
          {!editable
            ? 'laid out by dagre'
            : positionCount > 0
              ? `${positionCount} positions held in memory`
              : 'laid out by dagre'}
        </span>
        <div className="c4-playground__zoom">
          <button
            type="button"
            onClick={() => stepZoom(-1)}
            disabled={relativeZoom <= ZOOM_STEPS[0] + 0.001}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          {/* A percentage of the fitted view, not of actual size: 100% is what
              the reader opened, which is the thing the number should describe. */}
          <button
            type="button"
            onClick={() => setRelativeZoom(1)}
            disabled={relativeZoom === 1}
            aria-label="Zoom to fit"
            title="Zoom to fit"
          >
            {Math.round(relativeZoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            disabled={relativeZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.001}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="c4-playground__expand"
          onClick={() => setIsExpanded((v) => !v)}
          aria-pressed={isExpanded}
          // The glyph is not an accessible name — a screen reader announces the
          // character, or nothing. `title` is not reliably announced either.
          aria-label={isExpanded ? 'Close expanded diagram' : 'Expand diagram'}
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
        <div className="c4-playground__canvas" ref={canvasRef}>
          {parsed.diagram && parsed.errors.length === 0 ? (
            <C4InteractiveRenderer
              diagram={parsed.diagram}
              isDarkMode={isDark}
              isEditMode={editable && isEditMode}
              manualPositions={positions}
              onPositionChange={setPositions}
              zoom={zoom}
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
