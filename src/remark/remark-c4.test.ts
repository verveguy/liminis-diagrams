import { describe, it, expect } from 'vitest';
import { remarkC4 } from './remark-c4';
import type { MdastNode } from './remark-c4';

/**
 * The plugin decides whether every diagram on a documentation site renders at
 * all, and it had no tests while it lived as five copies in five repositories.
 *
 * Trees are built by hand rather than parsed from markdown: the plugin's
 * contract is with the mdast it is handed, and constructing that directly keeps
 * remark itself out of the package's dev dependencies.
 */

const fence = (value: string, meta?: string): MdastNode => ({
  type: 'code',
  lang: 'c4',
  ...(meta === undefined ? {} : { meta }),
  value,
});

const root = (...children: MdastNode[]): MdastNode => ({ type: 'root', children });

const run = (tree: MdastNode, options = {}) => {
  remarkC4(options)(tree);
  return tree;
};

const island = (tree: MdastNode) =>
  tree.children?.find((c) => c.type === 'mdxJsxFlowElement');
const attr = (node: MdastNode | undefined, name: string) =>
  node?.attributes?.find((a) => a.name === name);

describe('remarkC4', () => {
  it('replaces a c4 fence with an island and injects one import', () => {
    const tree = run(root(fence('Person(u, "You")')));
    expect(island(tree)?.name).toBe('C4Playground');
    expect(tree.children?.filter((c) => c.type === 'mdxjsEsm')).toHaveLength(1);
  });

  it('injects the import once however many diagrams a page holds', () => {
    const tree = run(root(fence('a'), fence('b'), fence('c')));
    expect(tree.children?.filter((c) => c.type === 'mdxjsEsm')).toHaveLength(1);
    expect(tree.children?.filter((c) => c.type === 'mdxJsxFlowElement')).toHaveLength(3);
  });

  it('leaves other languages alone', () => {
    const tree = run(root({ type: 'code', lang: 'ts', value: 'const x = 1' }));
    expect(tree.children?.[0].type).toBe('code');
    expect(tree.children?.some((c) => c.type === 'mdxjsEsm')).toBe(false);
  });

  it('adds nothing at all to a page with no diagrams', () => {
    const tree = run(root({ type: 'paragraph', children: [] }));
    expect(tree.children).toHaveLength(1);
  });

  it('carries the fence source into the island', () => {
    const source = 'Person(u, "You")\nSystem(a, "App")';
    const tree = run(root(fence(source)));
    // The source travels as an expression attribute, so it survives newlines
    // and quotes that a plain string attribute would mangle.
    expect(JSON.stringify(attr(island(tree), 'source'))).toContain('System(a');
  });

  it('mounts client-only, because drag measures a live SVG', () => {
    const tree = run(root(fence('x')));
    expect(attr(island(tree), 'client:only')?.value).toBe('react');
  });

  describe('fence meta', () => {
    it('static means readOnly and not editable', () => {
      const tree = run(root(fence('x', 'static')));
      expect(attr(island(tree), 'readOnly')).toBeDefined();
      expect(attr(island(tree), 'editable')).toBeDefined();
    });

    it('height is passed through verbatim', () => {
      const tree = run(root(fence('x', 'height=26rem')));
      expect(attr(island(tree), 'height')?.value).toBe('26rem');
    });

    it('ignores a word it does not know rather than failing the build', () => {
      // A fence is content. A typo in one should not take a docs site down.
      const tree = run(root(fence('x', 'readOnly wobble height=10rem')));
      expect(attr(island(tree), 'readOnly')).toBeDefined();
      expect(attr(island(tree), 'height')?.value).toBe('10rem');
    });
  });

  describe('the generated <picture> beside a fence', () => {
    const picture = (): MdastNode => ({
      type: 'mdxJsxFlowElement',
      name: 'picture',
      children: [
        { type: 'mdxJsxFlowElement', name: 'source', attributes: [{ type: 'mdxJsxAttribute', name: 'srcset', value: './diagrams/x-dark.svg' }] },
        { type: 'mdxJsxFlowElement', name: 'img', attributes: [{ type: 'mdxJsxAttribute', name: 'src', value: './diagrams/x.svg' }] },
      ],
    });

    it('is stripped, since the island renders the same diagram', () => {
      const tree = run(root(fence('x'), picture()));
      expect(tree.children?.some((c) => c.name === 'picture')).toBe(false);
    });

    it('strips a bare <img> too, from before <picture> existed', () => {
      const img: MdastNode = {
        type: 'mdxJsxFlowElement',
        name: 'img',
        attributes: [{ type: 'mdxJsxAttribute', name: 'src', value: './diagrams/x.svg' }],
      };
      const tree = run(root(fence('x'), img));
      expect(tree.children?.some((c) => c.name === 'img')).toBe(false);
    });

    it('leaves an unrelated image alone', () => {
      const img: MdastNode = {
        type: 'mdxJsxFlowElement',
        name: 'img',
        attributes: [{ type: 'mdxJsxAttribute', name: 'src', value: './screenshot.png' }],
      };
      const tree = run(root(fence('x'), img));
      expect(tree.children?.some((c) => c.name === 'img')).toBe(true);
    });
  });

  describe('the component path', () => {
    it('defaults to the alias every Liminis site uses', () => {
      const tree = run(root(fence('x')));
      const esm = tree.children?.find((c) => c.type === 'mdxjsEsm');
      expect(esm?.value).toContain('@site/components/C4Playground.tsx');
    });

    it('can be pointed somewhere else', () => {
      const tree = run(root(fence('x')), { component: '~/ui/Diagram' });
      const esm = tree.children?.find((c) => c.type === 'mdxjsEsm');
      expect(esm?.value).toContain('~/ui/Diagram');
      // The estree the bundler actually reads has to agree with the text.
      expect(JSON.stringify(esm?.data)).toContain('~/ui/Diagram');
    });
  });
});
