import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Validates that all Mermaid diagram strings in ArchitectureView.vue
 * are syntactically valid by checking they contain expected markers.
 */
const vuePath = resolve(__dirname, '../../src/views/ArchitectureView.vue')
const source = readFileSync(vuePath, 'utf-8')

// Extract diagram strings from the `const diagrams = { ... }` block
const diagramBlock = source.match(/const diagrams = \{(.+?)\n\}/s)?.[1] || ''
const diagramEntries = [...diagramBlock.matchAll(/(\w+):\s*`([^`]+)`/gs)]

describe('Architecture diagrams', () => {
  it('has exactly 9 diagrams defined', () => {
    expect(diagramEntries.length).toBe(9)
  })

  it('pre-renders diagrams via mermaid.render() to avoid HTML parsing issues', () => {
    expect(source).toContain('mermaid.render(')
    expect(source).toContain('renderedSvgs')
    expect(source).not.toMatch(/class="mermaid">\s*\{\{/)
  })

  const expectedDiagrams = [
    { name: 'infra', mustContain: 'flowchart', nodes: ['WEB', 'API', 'CAPI', 'PG', 'ZIT', 'NEO'] },
    { name: 'schema', mustContain: 'erDiagram', nodes: ['Company', 'Contract', 'CLIENT_OF'] },
    { name: 'layers', mustContain: 'flowchart', nodes: ['GraphAPI', 'CommunityAPI', 'ReportRepository', 'PermissionService'] },
    { name: 'api', mustContain: 'flowchart', nodes: ['Financial', 'Reports', 'Issues', 'Mod'] },
    { name: 'etl', mustContain: 'flowchart', nodes: ['GLEIF_L1', 'TED_PKG', 'DEDUP'] },
    { name: 'frontend', mustContain: 'flowchart', nodes: ['ReportPages', 'CommunityPages', 'WidgetRenderer'] },
    { name: 'reportflow', mustContain: 'sequenceDiagram', nodes: ['community-api', 'PostgreSQL', 'Neo4j'] },
    { name: 'separation', mustContain: 'flowchart', nodes: ['PostgreSQL', 'Neo4j', 'reports', 'Company'] },
    { name: 'identity', mustContain: 'flowchart', nodes: ['GLEIF', 'EDGAR', 'DEDUP'] },
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
