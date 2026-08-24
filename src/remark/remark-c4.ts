/**
 * Turn ```c4 fenced code blocks into live <C4Playground> islands.
 *
 * The point is a single source of truth that renders usefully in both places:
 *
 *   - **GitHub** shows the fence as a syntax-highlighted code block. Honest and
 *     readable with no build step, which matters because these files are read on
 *     github.com as often as on the docs site.
 *   - **The docs site** replaces it with the interactive component.
 *
 * The alternative was hand-writing `<C4Playground source={...} />` per diagram,
 * which duplicates the source into JSX, makes the page unreadable on GitHub, and
 * forces every page carrying a diagram to be MDX-authored rather than markdown.
 *
 * Fence meta becomes props, so a diagram can say how it wants to be shown:
 *
 *     ```c4 readOnly height=26rem
 *     ```c4 static            (readOnly, drag off — a pure illustration)
 *
 * Unknown meta words are ignored rather than throwing: a fence is content, and
 * a typo in it should not fail a docs build.
 */

/**
 * The mdast/mdx node shapes this plugin touches, typed only as far as it uses
 * them. Deliberately not `@types/mdast`: that would be a dependency for a
 * build-time plugin, and the tree this walks is already whatever the host's
 * remark version produced. `unknown`-valued extras keep the shape open.
 */
export interface MdastNode {
  type: string
  name?: string
  lang?: string
  meta?: string
  value?: string
  children?: MdastNode[]
  attributes?: { type: string; name?: string; value?: unknown }[]
  data?: Record<string, unknown>
  [key: string]: unknown
}

export interface RemarkC4Options {
  /**
   * Module specifier the injected `import` points at. Defaults to
   * `@site/components/C4Playground.tsx`, the convention the Liminis sites use:
   * an alias, so one string is correct at every page depth.
   */
  component?: string
}

type Visitor = (node: MdastNode, index: number | null, parent: MdastNode | null) => void

const COMPONENT = 'C4Playground'
/**
 * Where the island component is imported from, by default.
 *
 * An alias rather than a relative path: the injected import is the same string
 * on every page, but pages need not sit at the same depth, and a relative path
 * would be correct for exactly one of them. Hosts using a different convention
 * pass `component` instead.
 */
const DEFAULT_COMPONENT_PATH = '@site/components/C4Playground.tsx'

/**
 * Walk every node, depth-first, with its parent and index.
 *
 * `unist-util-visit` does this and more, and using it would have made
 * @liminis/diagrams depend on something beyond dagre — an invariant the package
 * asserts about itself and that keeps `./core` as small as it claims to be. Both
 * uses here are plain traversals, so the general version buys nothing.
 *
 * Children are walked before the callback sees the parent's later siblings, and
 * the callback must not splice: collect first, mutate after. Both callers do.
 */
function walk(
  node: MdastNode,
  visitor: Visitor,
  parent: MdastNode | null = null,
  index: number | null = null,
): void {
  visitor(node, index, parent)
  const children = node.children
  if (!Array.isArray(children)) return
  // A copy, so a callback that does mutate cannot make this skip a node.
  for (const [i, child] of [...children].entries()) walk(child, visitor, node, i)
}

/** An mdast attribute whose value is a JS expression rather than a string. */
function expressionAttribute(name: string, value: unknown) {
  return {
    type: 'mdxJsxAttribute',
    name,
    value: {
      type: 'mdxJsxAttributeValueExpression',
      value: JSON.stringify(value),
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'ExpressionStatement',
              expression: { type: 'Literal', value, raw: JSON.stringify(value) },
            },
          ],
        },
      },
    },
  }
}

function booleanAttribute(name: string, value: boolean) {
  return value
    ? { type: 'mdxJsxAttribute', name, value: null }
    : expressionAttribute(name, false)
}

function parseMeta(meta: string | undefined) {
  const props: { type: string; name: string; value: unknown }[] = []
  if (!meta) return props
  for (const token of meta.trim().split(/\s+/)) {
    if (!token) continue
    const [key, raw] = token.split('=')
    switch (key) {
      case 'readOnly':
        props.push(booleanAttribute('readOnly', true))
        break
      case 'static':
        // Shorthand: an illustration, not an invitation to edit or drag.
        props.push(booleanAttribute('readOnly', true))
        props.push(booleanAttribute('editable', false))
        break
      case 'editable':
        props.push(booleanAttribute('editable', raw !== 'false'))
        break
      case 'height':
        if (raw) props.push({ type: 'mdxJsxAttribute', name: 'height', value: raw })
        break
      default:
        // Ignored on purpose — see the note above.
        break
    }
  }
  return props
}

/** `import C4Playground from '…'`, built as estree rather than parsed. */
function importNode(componentPath: string): MdastNode {
  return {
    type: 'mdxjsEsm',
    value: `import ${COMPONENT} from '${componentPath}'`,
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ImportDeclaration',
            specifiers: [
              {
                type: 'ImportDefaultSpecifier',
                local: { type: 'Identifier', name: COMPONENT },
              },
            ],
            source: { type: 'Literal', value: componentPath, raw: `'${componentPath}'` },
            attributes: [],
          },
        ],
      },
    },
  }
}

/**
 * The generated `<picture>` blocks exist for GitHub, which has no build step.
 * Here the island renders the same diagram interactively, so showing both would
 * be duplication — they are stripped. See scripts/render-diagrams.mjs.
 *
 * Identified by the paths inside them rather than by a marker comment: MDX does
 * not permit HTML comments at all, so `<!-- … -->` is a syntax error rather than
 * a marker.
 *
 * Bare `<img>` is still matched: a page written before the light/dark
 * `<picture>` existed should lose its old block rather than keep it beside the
 * island.
 */
function referencesGeneratedDiagram(node: MdastNode): boolean {
  if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return false
  return (node.attributes ?? []).some(
    (a) =>
      (a.name === 'src' || a.name === 'srcset') &&
      typeof a.value === 'string' &&
      a.value.includes('/diagrams/'),
  )
}

function isGeneratedImage(node: MdastNode): boolean {
  if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return false
  if (node.name === 'img') return referencesGeneratedDiagram(node)
  if (node.name !== 'picture') return false
  return (node.children ?? []).some(referencesGeneratedDiagram)
}

function stripRenderedImages(tree: MdastNode): void {
  const doomed: { index: number; parent: MdastNode }[] = []
  walk(tree, (node, index, parent) => {
    if (parent && index !== null && isGeneratedImage(node)) doomed.push({ index, parent })
  })
  // Remove back-to-front so earlier indices stay valid.
  for (const { index, parent } of doomed.reverse()) parent.children?.splice(index, 1)
}

export function remarkC4(options: RemarkC4Options = {}) {
  const componentPath = options.component ?? DEFAULT_COMPONENT_PATH

  return (tree: MdastNode): void => {
    stripRenderedImages(tree)

    const replacements: { node: MdastNode; index: number; parent: MdastNode }[] = []

    walk(tree, (node, index, parent) => {
      if (node.type !== 'code' || node.lang !== 'c4' || !parent || index === null) return
      replacements.push({ node, index, parent })
    })

    if (replacements.length === 0) return

    for (const { node, index, parent } of replacements) {
      parent.children![index] = {
        type: 'mdxJsxFlowElement',
        name: COMPONENT,
        attributes: [
          // The drag layer measures the live SVG via getScreenCTM, which does
          // not exist during a server render, so these cannot be hydrated with
          // client:visible.
          { type: 'mdxJsxAttribute', name: 'client:only', value: 'react' },
          expressionAttribute('source', node.value),
          ...parseMeta(node.meta),
        ],
        children: [],
      }
    }

    // One import for the file, regardless of how many diagrams it holds.
    tree.children?.unshift(importNode(componentPath))
  }
}

export default remarkC4
