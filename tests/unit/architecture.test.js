import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Validates that all Mermaid diagram strings in ArchitectureView.vue
 * are syntactically valid by checking they contain expected markers.
 *
 * For full rendering validation, run `mmdc` (mermaid CLI) — this test
 * catches structural issues without needing a browser or puppeteer.
 */
const vuePath = resolve(__dirname, '../../src/views/ArchitectureView.vue')
const source = readFileSync(vuePath, 'utf-8')

// Extract diagram strings from the `const diagrams = { ... }` block
const diagramBlock = source.match(/const diagrams = \{(.+?)\n\}/s)?.[1] || ''
const diagramEntries = [...diagramBlock.matchAll(/(\w+):\s*`([^`]+)`/gs)]

describe('Architecture diagrams', () => {
  it('has exactly 5 diagrams defined', () => {
    expect(diagramEntries.length).toBe(5)
  })

  it('pre-renders diagrams via mermaid.render() to avoid HTML parsing issues', () => {
    // mermaid.render() generates SVG strings from raw text — no HTML parsing.
    // The SVGs are stored in renderedSvgs and injected via v-html (safe: SVG output).
    expect(source).toContain('mermaid.render(')
    expect(source).toContain('renderedSvgs')
    // Must NOT use {{ }} or textContent with mermaid.run() — both have issues
    expect(source).not.toMatch(/class="mermaid">\s*\{\{/)
  })

  const expectedDiagrams = [
    { name: 'system', mustContain: 'flowchart', nodes: ['WEB', 'API', 'NEO'] },
    { name: 'interfaces', mustContain: 'classDiagram', nodes: ['FinancialDataSource', 'ContractDataSource'] },
    { name: 'schema', mustContain: 'erDiagram', nodes: ['Company', 'Contract', 'Person'] },
    { name: 'pipeline', mustContain: 'flowchart', nodes: ['GLEIF_L1', 'TED', 'NEO'] },
    { name: 'request', mustContain: 'sequenceDiagram', nodes: ['Browser', 'FastAPI', 'Neo4j'] },
  ]

  for (const { name, mustContain, nodes } of expectedDiagrams) {
    describe(name, () => {
      const entry = diagramEntries.find(([, key]) => key === name)
      const content = entry ? entry[2] : ''

      it(`exists in the diagrams object`, () => {
        expect(entry).toBeTruthy()
      })

      it(`starts with ${mustContain}`, () => {
        expect(content.trim()).toMatch(new RegExp(`^${mustContain}`))
      })

      for (const node of nodes) {
        it(`contains node "${node}"`, () => {
          expect(content).toContain(node)
        })
      }

      it('has no unescaped backslash-n (use <br/> instead)', () => {
        const rawBackslashN = content.match(/(?<!<br)\\n/g)
        expect(rawBackslashN).toBeNull()
      })
    })
  }
})
