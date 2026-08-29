/**
 * Table-driven pins for the DQ chart registry. Every chart_key is
 * asserted for its endpoint (source), primitive (chart) and the exact
 * props its build() emits for a representative payload — a pocketed
 * chart re-runs build() on refetched data, so these transforms are the
 * dashboard's rendering contract.
 */
import { describe, it, expect } from 'vitest'
import { DQ_CHARTS, dqChart } from '../../src/widgets/dqCharts.js'
import { fmtEur } from '../../src/utils/format.js'

// key: [source, chart, payload, dataParams, expectedProps]
const CASES = {
  contracts_total: ['contracts/timeline', 'stat', [{ value: 40 }, { value: 2 }], null,
    { value: '42', label: 'Total Contracts' }],
  contracts_total_eur: ['contracts/value-timeline', 'stat', [{ value: 900 }, { value: 100 }], null,
    { value: fmtEur(1000), label: 'Total EUR Value' }],
  contracts_countries: ['contracts/by-country', 'stat', [{}, {}, {}], null,
    { value: 3, label: 'Countries' }],
  contracts_undisclosed_value: ['contracts/currency-quality', 'stat',
    { value_undisclosed: 25, total: 100 }, null,
    { value: '25%', label: 'Undisclosed Value', color: '#d97706' }],
  contracts_single_bidder_rate: ['contracts/integrity', 'stat', { single_bidder_rate: 0.35 }, null,
    { value: '35%', label: 'Single-bidder rate', color: '#dc2626' }],
  contracts_single_bidder_count: ['contracts/integrity', 'stat', { single_bidder: 7 }, null,
    { value: '7', label: 'Single-bidder contracts' }],
  contracts_bidder_coverage: ['contracts/integrity', 'stat', { bidder_count_coverage: 0.5 }, null,
    { value: '50%', label: 'Bidder-count coverage' }],
  contracts_proc_coverage: ['contracts/integrity', 'stat', { procedure_type_coverage: 0.8 }, null,
    { value: '80%', label: 'Procedure-type coverage' }],
  contracts_single_bidder_rate_gauge: ['contracts/integrity', 'gauge', { single_bidder_rate: 0.2 }, null,
    { value: 20, label: 'Single-bidder rate' }],
  contracts_bidder_coverage_gauge: ['contracts/integrity', 'gauge', { bidder_count_coverage: 0.9 }, null,
    { value: 90, label: 'Bidder-count coverage' }],
  contracts_red_flags: ['contracts/integrity', 'bar_h',
    { flags: { single_bidder: 5, non_open: 9, mystery: 2 } }, null,
    { data: [{ label: 'Non-open procedure', value: 9 }, { label: 'Single bidder', value: 5 },
      { label: 'mystery', value: 2 }], color: '#d97706' }],
  contracts_red_flag_dist: ['contracts/integrity', 'bar_h',
    { red_flag_distribution: [{ flags: 1, contracts: 4 }, { flags: 2, contracts: 6 }] }, null,
    { data: [{ label: '1 flag', value: 4 }, { label: '2 flags', value: 6 }], color: '#dc2626' }],
  contracts_conversion_gauge: ['contracts/currency-quality', 'gauge',
    { converted_to_eur: 80, total: 100 }, null, { value: 80, label: 'EUR Conversion Success' }],
  contracts_value_disclosed_gauge: ['contracts/currency-quality', 'gauge',
    { value_undisclosed: 25, total: 100 }, null, { value: 75, label: 'Value Disclosed' }],
  contracts_volume_timeline: ['contracts/timeline', 'ts_bar', [{ date: 'd', value: 1 }], null,
    { data: [{ date: 'd', value: 1 }], valueLabel: 'Contracts', height: 350 }],
  contracts_value_timeline: ['contracts/value-timeline', 'ts_bar', [{ date: 'd', value: 2 }], null,
    { data: [{ date: 'd', value: 2 }], valueLabel: 'EUR', height: 300, format: 'eur', color: '#16a34a' }],
  contracts_by_country: ['contracts/by-country', 'bar_h',
    [{ country: 'DE', contracts: 5 }], null,
    { data: [{ label: 'DE', value: 5 }], maxBars: 25 }],
  contracts_by_country_eur: ['contracts/by-country', 'bar_h',
    [{ country: 'DE', total_eur: 9 }, { country: 'FR' }], null,
    { data: [{ label: 'DE', value: 9 }, { label: 'FR', value: 0 }], maxBars: 15, format: 'eur', color: '#16a34a' }],
  contracts_by_currency: ['contracts/currency-quality', 'bar_h',
    { by_currency: [{ currency: 'EUR', contracts: 3 }] }, null,
    { data: [{ label: 'EUR', value: 3 }], maxBars: 20 }],
  contracts_missing_fields: ['contracts/nulls', 'bar_h',
    { total: 200, missing: { end_date: 100, cpv_code: 50 } }, null,
    { data: [{ label: 'end date', value: 50 }, { label: 'cpv code', value: 25 }], format: 'pct', color: '#dc2626' }],

  lobbying_total: ['lobbying', 'stat', { total: 12 }, null, { value: '12', label: 'Lobbyists' }],
  lobbying_ep_passes: ['lobbying', 'stat', { with_ep_passes: 3 }, null, { value: '3', label: 'EP Pass Holders' }],
  lobbying_matched: ['lobbying', 'stat', { matched_to_company: 4 }, null, { value: '4', label: 'Matched to Company' }],
  lobbying_match_rate: ['lobbying', 'gauge', { match_rate: 66 }, null, { value: 66, label: 'Company Match Rate' }],
  lobbying_registrations_timeline: ['lobbying', 'ts_bar', { registrations_timeline: [{ date: 'd', value: 1 }] }, null,
    { data: [{ date: 'd', value: 1 }], valueLabel: 'Registrations' }],
  lobbying_by_country: ['lobbying', 'bar_h', { by_country: [{ country: 'BE', count: 8 }] }, null,
    { data: [{ label: 'BE', value: 8 }] }],
  lobbying_cost_distribution: ['lobbying', 'bar_h', { cost_distribution: [{ bucket: '<10k', count: 2 }] }, null,
    { data: [{ label: '<10k', value: 2 }], color: '#d97706' }],
  lobbying_top_companies: ['lobbying', 'bar_h', { top_companies: [{ company: 'ACME', lobbyists: 6 }] }, null,
    { data: [{ label: 'ACME', value: 6 }], maxBars: 20, color: '#0a66c2' }],
  lobbying_by_category: ['lobbying', 'bar_h', { by_category: [{ category: 'NGO', count: 5 }] }, null,
    { data: [{ label: 'NGO', value: 5 }], maxBars: 15, color: '#7c3aed' }],
  lobbying_top_spenders: ['lobbying', 'bar_h', { top_spenders: [{ lobbyist: 'X', cost_max: 400 }] }, null,
    { data: [{ label: 'X', value: 400 }], maxBars: 20, format: 'eur', color: '#16a34a' }],

  gleif_total: ['gleif', 'stat', { total: 9 }, null, { value: '9', label: 'Total Companies' }],
  gleif_with_lei: ['gleif', 'stat', { with_lei: 8 }, null, { value: '8', label: 'With LEI' }],
  gleif_subsidiary_links: ['gleif', 'stat', { subsidiary_links: 7 }, null, { value: '7', label: 'Subsidiary Links' }],
  gleif_orphan_subsidiaries: ['gleif', 'stat', { orphan_subsidiaries: 6 }, null,
    { value: '6', label: 'Orphan Subsidiaries', color: '#d97706' }],
  gleif_lei_coverage: ['gleif', 'gauge', { with_lei: 50, total: 100 }, null, { value: 50, label: 'LEI Coverage' }],
  gleif_active: ['gleif', 'gauge', { active: 25, total: 100 }, null, { value: 25, label: 'Active Companies' }],
  gleif_by_country: ['gleif', 'bar_h', { by_country: [{ country: 'DE', count: 3 }] }, null,
    { data: [{ label: 'DE', value: 3 }], maxBars: 30 }],

  firds_total: ['firds', 'stat', { total: 5 }, null, { value: '5', label: 'Total Instruments (with ISIN)' }],
  firds_with_ticker: ['firds', 'stat', { with_ticker: 4 }, null, { value: '4', label: 'With Ticker' }],
  firds_without_ticker: ['firds', 'stat', { without_ticker: 1 }, null, { value: '1', label: 'Without Ticker' }],
  firds_ticker_coverage: ['firds', 'gauge', { ticker_rate: 80 }, null, { value: 80, label: 'Ticker Coverage' }],
  firds_by_type: ['firds', 'bar_h', { by_instrument_type: [{ type: 'EQ', count: 2 }] }, null,
    { data: [{ label: 'EQ', value: 2 }], maxBars: 15 }],
  firds_by_venue: ['firds', 'bar_h', { by_venue: [{ venue: 'XETR', count: 9 }] }, null,
    { data: [{ label: 'XETR', value: 9 }], maxBars: 10 }],

  nuts_total_regions: ['nuts', 'stat', { total_regions: 3 }, null, { value: '3', label: 'Total Regions' }],
  nuts_companies_linked: ['nuts', 'stat', { companies_linked: 2 }, null, { value: '2', label: 'Companies Linked' }],
  nuts_authorities_linked: ['nuts', 'stat', { authorities_linked: 1 }, null, { value: '1', label: 'Authorities Linked' }],
  nuts_coverage: ['nuts', 'gauge', { company_coverage_pct: 61.4 }, null, { value: 61, label: 'Company Coverage' }],
  nuts_top_regions: ['nuts', 'bar_h', { top_regions: [{ code: 'DE11', name: 'Stuttgart', companies: 5 }] }, null,
    { data: [{ label: 'DE11 — Stuttgart', value: 5 }], maxBars: 15 }],
  nuts_by_level: ['nuts', 'bar_h', { by_level: [{ level: 2, n: 4 }] }, null,
    { data: [{ label: 'Level 2', value: 4 }], maxBars: 4 }],

  sanctions_total: ['sanctions', 'stat', { total: 8 }, null, { value: '8', label: 'Total Sanctioned Entities' }],
  sanctions_persons: ['sanctions', 'stat', { persons: 5 }, null, { value: '5', label: 'Persons' }],
  sanctions_entities: ['sanctions', 'stat', { entities: 3 }, null, { value: '3', label: 'Organisations' }],
  sanctions_matched: ['sanctions', 'stat', { matched_to_companies: 2 }, null, { value: '2', label: 'Matched to Companies' }],
  sanctions_match_rate: ['sanctions', 'gauge', { matched_to_companies: 30, total: 100 }, null,
    { value: 30, label: 'Company Match Rate' }],
  sanctions_top_regimes: ['sanctions', 'bar_h', { top_regimes: [{ regime: 'RU', n: 7 }] }, null,
    { data: [{ label: 'RU', value: 7 }], maxBars: 10 }],

  esef_companies: ['esef', 'stat', { companies: 4 }, null, { value: '4', label: 'EU Companies' }],
  esef_financial_years: ['esef', 'stat', { financial_years: 9 }, null, { value: '9', label: 'Financial Years' }],
  esef_by_year: ['esef', 'ts_bar', { by_year: [{ date: 'd', value: 1 }] }, null,
    { data: [{ date: 'd', value: 1 }], valueLabel: 'Filings' }],
  esef_by_country: ['esef', 'bar_h', { by_country: [{ country: 'PT', count: 2 }] }, null,
    { data: [{ label: 'PT', value: 2 }] }],
  esef_field_coverage: ['esef', 'bar_h', { field_coverage: { net_income: 90 } }, null,
    { data: [{ label: 'net income', value: 90 }], format: 'pct', color: '#16a34a' }],

  eukg_total_projects: ['eu-knowledge-graph', 'stat', { total_projects: 6 }, null,
    { value: '6', label: 'Total Projects' }],
  eukg_beneficiary_links: ['eu-knowledge-graph', 'stat', { beneficiary_links: 5 }, null,
    { value: '5', label: 'Beneficiary Links' }],
  eukg_eu_contribution: ['eu-knowledge-graph', 'stat', { total_eu_contribution: 2.5e9 }, null,
    { value: '€2.50B', label: 'EU Contribution' }],
  eukg_by_fund: ['eu-knowledge-graph', 'bar_h', { by_fund: [{ fund: 'ERDF', n: 3 }] }, null,
    { data: [{ label: 'ERDF', value: 3 }], maxBars: 10 }],
  eukg_by_country: ['eu-knowledge-graph', 'bar_h', { by_country: [{ country: 'ES', n: 2 }] }, null,
    { data: [{ label: 'ES', value: 2 }], maxBars: 15 }],

  edgar_companies: ['edgar', 'stat', { companies: 7 }, null, { value: '7', label: 'US Companies' }],
  edgar_financial_years: ['edgar', 'stat', { financial_years: 8 }, null, { value: '8', label: 'Financial Years' }],
  edgar_by_year: ['edgar', 'ts_bar', { by_year: [{ date: 'd', value: 3 }] }, null,
    { data: [{ date: 'd', value: 3 }], valueLabel: 'Filings' }],
  edgar_field_coverage: ['edgar', 'bar_h', { field_coverage: { total_assets: 95 } }, null,
    { data: [{ label: 'total assets', value: 95 }], format: 'pct', color: '#16a34a' }],

  cdp_companies_with_score: ['cdp', 'stat', { companies_with_score: 4 }, null,
    { value: '4', label: 'Companies with CDP Score' }],
  cdp_score_distribution: ['cdp', 'bar_h', { score_distribution: [{ score: 'A', count: 2 }] }, null,
    { data: [{ label: 'A', value: 2 }], maxBars: 10 }],
  cdp_by_year: ['cdp', 'bar_h', { by_reporting_year: [{ year: 2024, count: 5 }] }, null,
    { data: [{ label: 2024, value: 5 }], maxBars: 10 }],

  dedup_pending: ['dedup', 'stat', { pending: 3 }, null, { value: 3, label: 'Pending Review', color: '#d97706' }],
  dedup_reviewed: ['dedup', 'stat', { reviewed: 2 }, null, { value: 2, label: 'Reviewed', color: '#16a34a' }],
  dedup_total: ['dedup', 'stat', { total: 5 }, null, { value: 5, label: 'Total SAME_AS' }],

  trade_pairs: ['trade-edges', 'stat', { trade_pairs: 9 }, null, { value: '9', label: 'Trade Pairs' }],
  trade_total_eur: ['trade-edges', 'stat', { total_eur: 5000 }, null,
    { value: fmtEur(5000), label: 'Total EUR Value' }],
  trade_total_contracts: ['trade-edges', 'stat', { total_contracts: 6 }, null,
    { value: '6', label: 'Total Contracts' }],

  conn_total_nodes: ['connectedness', 'stat',
    { per_type: [{ count: 5 }, { count: 4 }] }, null, { value: '9', label: 'Total Nodes' }],
  conn_isolated: ['connectedness', 'stat',
    { per_type: [{ isolated_count: 2 }, { isolated_count: 1 }] }, null, { value: '3', label: 'Isolated' }],
  conn_isolated_pct: ['connectedness', 'stat',
    { per_type: [{ count: 8, isolated_count: 2 }] }, null, { value: '25.0%', label: 'Isolated %' }],
  conn_histogram: ['connectedness', 'bar_h',
    { per_type: [{ entity_type: 'Company', histogram: [{ bucket: '0', count: 4 }] }] },
    { entity_type: 'Company' },
    { data: [{ label: '0', value: 4 }], maxBars: 8 }],

  triples_total: ['triples', 'stat', { total_triples: 7 }, null, { value: '7', label: 'Total triples' }],
  triples_graphs: ['triples', 'stat', { graphs: [{}, {}] }, null, { value: '2', label: 'Named graphs' }],
  triples_snapshot: ['triples', 'stat', {}, null, { value: '—', label: 'Snapshot taken' }],
  triples_graphs_bars: ['triples', 'bar_h', { graphs: [{ label: 'g', triples: 3 }] }, null,
    { data: [{ label: 'g', value: 3 }], maxBars: 20 }],
  triples_classes: ['triples', 'bar_h',
    { graphs: [{ iri: 'g1', classes: [{ class: 'http://data.fontem.eu/ontology#Company', n: 2 }] }] },
    { graph_iri: 'g1' },
    { data: [{ label: 'fontem:Company', value: 2 }], maxBars: 15 }],
  triples_predicates: ['triples', 'bar_h',
    { graphs: [{ iri: 'g1', top_predicates: [{ predicate: 'https://schema.org/name', n: 5 }] }] },
    { graph_iri: 'g1' },
    { data: [{ label: 'schema:name', value: 5 }], maxBars: 15 }],

  overview_overlap_contracts_cohesion: ['cross-source-overlap', 'stat', { contracts_and_cohesion: 1 }, null,
    { value: '1', label: 'Contracts + Cohesion' }],
  overview_overlap_contracts_lobby: ['cross-source-overlap', 'stat', { contracts_and_lobby: 2 }, null,
    { value: '2', label: 'Contracts + Lobby' }],
  overview_overlap_listed_contracts: ['cross-source-overlap', 'stat', { listed_and_contracts: 3 }, null,
    { value: '3', label: 'Listed + Contracts' }],
  overview_overlap_sanctions_matched: ['cross-source-overlap', 'stat', { sanctions_matched: 4 }, null,
    { value: '4', label: 'Sanctions Matched' }],
  overview_alpha2_count: ['country-codes', 'stat', { alpha2_count: 5 }, null, { value: '5', label: 'Alpha-2 Codes' }],
  overview_alpha3_count: ['country-codes', 'stat', { alpha3_count: 6 }, null, { value: '6', label: 'Alpha-3 Codes' }],
  overview_other_count: ['country-codes', 'stat', { other_count: 7 }, null, { value: '7', label: 'Other Format' }],
  overview_no_country_count: ['country-codes', 'stat', { no_country_count: 8 }, null, { value: '8', label: 'No Country' }],
  overview_alpha3_pct: ['country-codes', 'gauge', { alpha2_count: 25, alpha3_count: 50, other_count: 25 }, null,
    { value: 50, label: 'Alpha-3 %' }],
  overview_alpha2_pct: ['country-codes', 'gauge', { alpha2_count: 25, alpha3_count: 50, other_count: 25 }, null,
    { value: 25, label: 'Alpha-2 %' }],
  overview_top_alpha2: ['country-codes', 'bar_h', { top_alpha2_codes: [{ code: 'DE', n: 4 }] }, null,
    { data: [{ label: 'DE', value: 4 }], maxBars: 10 }],
}

describe('DQ chart registry', () => {
  it('the case table covers every registered chart and vice versa', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(DQ_CHARTS).sort())
  })

  it.each(Object.entries(CASES))('%s', (key, [source, chart, payload, dp, expected]) => {
    const entry = DQ_CHARTS[key]
    expect(entry.source).toBe(source)
    expect(entry.chart).toBe(chart)
    expect(entry.build(payload, dp || undefined)).toEqual(expected)
  })

  it('builds tolerate an empty payload without throwing', () => {
    for (const [key, entry] of Object.entries(DQ_CHARTS)) {
      expect(() => entry.build(undefined, undefined), key).not.toThrow()
    }
  })

  it('dqChart looks up by key and returns null for unknowns', () => {
    expect(dqChart('gleif_total')).toBe(DQ_CHARTS.gleif_total)
    expect(dqChart('nope')).toBeNull()
  })
})
