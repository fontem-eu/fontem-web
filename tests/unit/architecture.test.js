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
        // In the raw template literal, \\n would appear as a literal \n
        // which mermaid can't render. Should use <br/> for line breaks.
        const rawBackslashN = content.match(/(?<!<br)\\n/g)
        expect(rawBackslashN).toBeNull()
      })
    })
  }
})
