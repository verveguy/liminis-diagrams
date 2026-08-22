/**
 * Pipeline tests: C4 source -> parse -> layout.
 *
 * Extracted from liminis-editor's `c4/integration.test.ts`, which also asserted
 * markdown round-tripping (`parseMarkdown`/`stringifyMarkdown`) and the editor's
 * slash-menu wiring. Those halves are editor concerns and stay there; what is
 * portable is the parse-and-lay-out path, which is this package's whole job.
 */
import { describe, it, expect } from 'vitest';
import { parseC4 } from './parser';
import { layoutC4Diagram } from './layout';

describe('C4 pipeline', () => {
  it('should recognize c4 element types', () => {
    const parseResult = parseC4(`
Person(user, "User", "A user")
System(app, "App", "Main app")

System_Boundary(backend, "Backend") {
Container(api, "API", "Node.js")
Component(ctrl, "Controller", "Express")
}
    `);

    expect(parseResult.errors).toHaveLength(0);
    expect(parseResult.diagram!.elements).toHaveLength(5);

    const types = parseResult.diagram!.elements.map(e => e.type);
    expect(types).toContain('person');
    expect(types).toContain('system');
    expect(types).toContain('container');
    expect(types).toContain('component');
  });

  it("should parse the editor's default C4 template", () => {
    // The template liminis-editor's slash menu inserts. Kept here because it is
  // the most-typed C4 source in existence for this parser; the menu itself is
  // the editor's concern.
    const defaultTemplate = `Person(user, "User", "End user of the system")

System_Boundary(mySystem, "My System") {
Container(web, "Web App", "React", "Delivers the UI")
Container(api, "API Server", "Node.js", "Business logic")
ContainerDb(db, "Database", "PostgreSQL", "Stores data")
}

Rel(user, web, "Uses", "HTTPS")
Rel(web, api, "Calls", "REST/JSON")
Rel(api, db, "Reads/Writes", "SQL")`;

    const parseResult = parseC4(defaultTemplate);
    expect(parseResult.errors).toHaveLength(0);
    expect(parseResult.diagram).not.toBeNull();

    // Should have 5 elements (1 person + 1 boundary + 3 containers)
    expect(parseResult.diagram!.elements).toHaveLength(5);

    // Should have 3 relationships
    expect(parseResult.diagram!.relationships).toHaveLength(3);

    // Layout should succeed
    const layoutResult = layoutC4Diagram(parseResult.diagram!);
    expect(layoutResult.nodes.length).toBeGreaterThanOrEqual(5);
    expect(layoutResult.edges).toHaveLength(3);
  });

  it('lays out a parsed diagram with boundaries and relationships', () => {
    // The body of a ```c4 fence, verbatim — this package never sees the fence
    // itself. Mirrors the markdown-driven pipeline test left in liminis-editor.
    const source = `Person(user, "User", "End user")

System_Boundary(app, "My App") {
  Container(fe, "Frontend", "React")
  Container(be, "Backend", "Node.js")
}

Rel(user, fe, "Uses", "HTTPS")
Rel(fe, be, "API calls")`;

    const parsed = parseC4(source);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.diagram!.elements).toHaveLength(4);

    const layout = layoutC4Diagram(parsed.diagram!);
    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(2);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('lays out independent diagrams without shared state', () => {
    const context = `System(main, "Main System")
System_Ext(ext, "External System", "Third party")
Rel(main, ext, "Uses")`;

    const containers = `System_Boundary(main, "Main System") {
  Container(web, "Web", "React")
  Container(api, "API", "Node.js")
}
Rel(web, api, "Calls")`;

    for (const source of [context, containers]) {
      const parsed = parseC4(source);
      expect(parsed.errors).toHaveLength(0);
      expect(layoutC4Diagram(parsed.diagram!).nodes.length).toBeGreaterThan(0);
    }
  });
});
