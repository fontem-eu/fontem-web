/**
 * DQ chart registry — the new abstraction for data-quality dashboard charts.
 *
 * Each entry maps a stable `chart_key` to:
 *   source — the EXISTING /data-quality/<source> endpoint the data comes from
 *   chart  — the ChartSpec primitive (stat | bar_h | gauge | ts_bar | ts_line)
 *   build  — pure transform (payload) -> chart-props (data + display)
 *
 * A pocketed DQ chart stores only { data_params: { chart_key } } — no data.
 * DqChartEmbed refetches `source` from Dargle and runs `build`, so injected
 * data is impossible: the numbers can only come from the named endpoint.
 */
import { fmtEur } from '../utils/format.js'

const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const pct = (x) => (x == null ? null : Math.round(x * 100))
const statPct = (p, label, color) => ({
  value: (p ?? '—') + (p == null ? '' : '%'), label, ...(color ? { color } : {}),
})
const FLAG_LABELS = {
  single_bidder: 'Single bidder', non_open: 'Non-open procedure',
  no_call: 'No call for bids', price_only: 'Lowest-price only',
}


const IRI_PREFIXES = [
  ['http://data.fontem.eu/ontology#', 'fontem:'], ['http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdf:'],
  ['http://www.w3.org/2000/01/rdf-schema#', 'rdfs:'], ['http://www.w3.org/2002/07/owl#', 'owl:'],
  ['http://www.w3.org/2004/02/skos/core#', 'skos:'], ['http://www.w3.org/2001/XMLSchema#', 'xsd:'],
  ['https://schema.org/', 'schema:'], ['http://data.europa.eu/a4g/ontology#', 'epo:'],
]
function shortenIri(iri) {
  if (!iri) return ''
  for (const [base, prefix] of IRI_PREFIXES) { if (iri.startsWith(base)) return prefix + iri.slice(base.length) }
  const i = Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#'))
  return i >= 0 ? iri.slice(i + 1) : iri
}

export const DQ_CHARTS = {
  // ── TED contracts ─────────────────────────────────────────────
  contracts_total: { source: 'contracts/timeline', chart: 'stat',
    build: (tl) => ({ value: (tl || []).reduce((s, d) => s + d.value, 0).toLocaleString(), label: 'Total Contracts' }) },
  contracts_total_eur: { source: 'contracts/value-timeline', chart: 'stat',
    build: (vt) => ({ value: fmtEur((vt || []).reduce((s, d) => s + d.value, 0)), label: 'Total EUR Value' }) },
  contracts_countries: { source: 'contracts/by-country', chart: 'stat',
    build: (bc) => ({ value: (bc || []).length, label: 'Countries' }) },
  contracts_undisclosed_value: { source: 'contracts/currency-quality', chart: 'stat',
    build: (cq) => ({ value: pctOf(cq?.value_undisclosed, cq?.total) + '%', label: 'Undisclosed Value', color: '#d97706' }) },
  contracts_single_bidder_rate: { source: 'contracts/integrity', chart: 'stat',
    build: (it) => statPct(pct(it?.single_bidder_rate), 'Single-bidder rate', pct(it?.single_bidder_rate) >= 30 ? '#dc2626' : '#d97706') },
  contracts_single_bidder_count: { source: 'contracts/integrity', chart: 'stat',
    build: (it) => ({ value: (it?.single_bidder ?? 0).toLocaleString(), label: 'Single-bidder contracts' }) },
  contracts_bidder_coverage: { source: 'contracts/integrity', chart: 'stat',
    build: (it) => statPct(pct(it?.bidder_count_coverage), 'Bidder-count coverage') },
  contracts_proc_coverage: { source: 'contracts/integrity', chart: 'stat',
    build: (it) => statPct(pct(it?.procedure_type_coverage), 'Procedure-type coverage') },
  contracts_single_bidder_rate_gauge: { source: 'contracts/integrity', chart: 'gauge',
    build: (it) => ({ value: pct(it?.single_bidder_rate) || 0, label: 'Single-bidder rate' }) },
  contracts_bidder_coverage_gauge: { source: 'contracts/integrity', chart: 'gauge',
    build: (it) => ({ value: pct(it?.bidder_count_coverage) || 0, label: 'Bidder-count coverage' }) },
  contracts_red_flags: { source: 'contracts/integrity', chart: 'bar_h',
    build: (it) => ({ data: Object.entries(it?.flags || {}).map(([k, v]) => ({ label: FLAG_LABELS[k] || k, value: v })).sort((a, b) => b.value - a.value), color: '#d97706' }) },
  contracts_red_flag_dist: { source: 'contracts/integrity', chart: 'bar_h',
    build: (it) => ({ data: (it?.red_flag_distribution || []).map((d) => ({ label: `${d.flags} flag${d.flags === 1 ? '' : 's'}`, value: d.contracts })), color: '#dc2626' }) },
  contracts_conversion_gauge: { source: 'contracts/currency-quality', chart: 'gauge',
    build: (cq) => ({ value: pctOf(cq?.converted_to_eur, cq?.total), label: 'EUR Conversion Success' }) },
  contracts_value_disclosed_gauge: { source: 'contracts/currency-quality', chart: 'gauge',
    build: (cq) => ({ value: 100 - pctOf(cq?.value_undisclosed, cq?.total), label: 'Value Disclosed' }) },
  contracts_volume_timeline: { source: 'contracts/timeline', chart: 'ts_bar',
    build: (tl) => ({ data: tl || [], valueLabel: 'Contracts', height: 350 }) },
  contracts_value_timeline: { source: 'contracts/value-timeline', chart: 'ts_bar',
    build: (vt) => ({ data: vt || [], valueLabel: 'EUR', height: 300, format: 'eur', color: '#16a34a' }) },
  contracts_by_country: { source: 'contracts/by-country', chart: 'bar_h',
    build: (bc) => ({ data: (bc || []).slice(0, 25).map((c) => ({ label: c.country, value: c.contracts })), maxBars: 25 }) },
  contracts_by_country_eur: { source: 'contracts/by-country', chart: 'bar_h',
    build: (bc) => ({ data: (bc || []).slice(0, 15).map((c) => ({ label: c.country, value: c.total_eur || 0 })), maxBars: 15, format: 'eur', color: '#16a34a' }) },
  contracts_by_currency: { source: 'contracts/currency-quality', chart: 'bar_h',
    build: (cq) => ({ data: (cq?.by_currency || []).map((c) => ({ label: c.currency, value: c.contracts })), maxBars: 20 }) },
  contracts_missing_fields: { source: 'contracts/nulls', chart: 'bar_h',
    build: (nl) => { const t = nl?.total || 1; return { data: Object.entries(nl?.missing || {}).map(([f, c]) => ({ label: f.replace(/_/g, ' '), value: Math.round((c / t) * 100) })).sort((a, b) => b.value - a.value), format: 'pct', color: '#dc2626' } } },

  // ── Lobbying (EU Transparency Register) ───────────────────────
  lobbying_total: { source: 'lobbying', chart: 'stat',
    build: (d) => ({ value: (d?.total ?? 0).toLocaleString(), label: 'Lobbyists' }) },
  lobbying_ep_passes: { source: 'lobbying', chart: 'stat',
    build: (d) => ({ value: (d?.with_ep_passes ?? 0).toLocaleString(), label: 'EP Pass Holders' }) },
  lobbying_matched: { source: 'lobbying', chart: 'stat',
    build: (d) => ({ value: (d?.matched_to_company ?? 0).toLocaleString(), label: 'Matched to Company' }) },
  lobbying_match_rate: { source: 'lobbying', chart: 'gauge',
    build: (d) => ({ value: d?.match_rate ?? 0, label: 'Company Match Rate' }) },
  lobbying_registrations_timeline: { source: 'lobbying', chart: 'ts_bar',
    build: (d) => ({ data: d?.registrations_timeline || [], valueLabel: 'Registrations' }) },
  lobbying_by_country: { source: 'lobbying', chart: 'bar_h',
    build: (d) => ({ data: (d?.by_country || []).map((c) => ({ label: c.country, value: c.count })) }) },
  lobbying_cost_distribution: { source: 'lobbying', chart: 'bar_h',
    build: (d) => ({ data: (d?.cost_distribution || []).map((c) => ({ label: c.bucket, value: c.count })), color: '#d97706' }) },
  lobbying_top_companies: { source: 'lobbying', chart: 'bar_h',
    build: (d) => ({ data: (d?.top_companies || []).map((c) => ({ label: c.company, value: c.lobbyists })), maxBars: 20, color: '#0a66c2' }) },
  lobbying_by_category: { source: 'lobbying', chart: 'bar_h',
    build: (d) => ({ data: (d?.by_category || []).map((c) => ({ label: c.category, value: c.count })), maxBars: 15, color: '#7c3aed' }) },
  lobbying_top_spenders: { source: 'lobbying', chart: 'bar_h',
    build: (d) => ({ data: (d?.top_spenders || []).map((s) => ({ label: s.lobbyist, value: s.cost_max })), maxBars: 20, format: 'eur', color: '#16a34a' }) },

  // ── GLEIF (LEI / ownership) ───────────────────────────────────
  gleif_total: { source: 'gleif', chart: 'stat', build: (d) => ({ value: (d?.total ?? 0).toLocaleString(), label: 'Total Companies' }) },
  gleif_with_lei: { source: 'gleif', chart: 'stat', build: (d) => ({ value: (d?.with_lei ?? 0).toLocaleString(), label: 'With LEI' }) },
  gleif_subsidiary_links: { source: 'gleif', chart: 'stat', build: (d) => ({ value: (d?.subsidiary_links ?? 0).toLocaleString(), label: 'Subsidiary Links' }) },
  gleif_orphan_subsidiaries: { source: 'gleif', chart: 'stat', build: (d) => ({ value: (d?.orphan_subsidiaries ?? 0).toLocaleString(), label: 'Orphan Subsidiaries', color: '#d97706' }) },
  gleif_lei_coverage: { source: 'gleif', chart: 'gauge', build: (d) => ({ value: d ? Math.round((d.with_lei / Math.max(d.total, 1)) * 100) : 0, label: 'LEI Coverage' }) },
  gleif_active: { source: 'gleif', chart: 'gauge', build: (d) => ({ value: d ? Math.round((d.active / Math.max(d.total, 1)) * 100) : 0, label: 'Active Companies' }) },
  gleif_by_country: { source: 'gleif', chart: 'bar_h', build: (d) => ({ data: (d?.by_country || []).map((c) => ({ label: c.country, value: c.count })), maxBars: 30 }) },

  // ── FIRDS (ESMA instruments) ──────────────────────────────────
  firds_total: { source: 'firds', chart: 'stat', build: (d) => ({ value: (d?.total ?? 0).toLocaleString(), label: 'Total Instruments (with ISIN)' }) },
  firds_with_ticker: { source: 'firds', chart: 'stat', build: (d) => ({ value: (d?.with_ticker ?? 0).toLocaleString(), label: 'With Ticker' }) },
  firds_without_ticker: { source: 'firds', chart: 'stat', build: (d) => ({ value: (d?.without_ticker ?? 0).toLocaleString(), label: 'Without Ticker' }) },
  firds_ticker_coverage: { source: 'firds', chart: 'gauge', build: (d) => ({ value: d?.ticker_rate ?? 0, label: 'Ticker Coverage' }) },
  firds_by_type: { source: 'firds', chart: 'bar_h', build: (d) => ({ data: (d?.by_instrument_type || []).map((t) => ({ label: t.type, value: t.count })), maxBars: 15 }) },
  firds_by_venue: { source: 'firds', chart: 'bar_h', build: (d) => ({ data: (d?.by_venue || []).map((v) => ({ label: v.venue, value: v.count })), maxBars: 10 }) },

  // ── NUTS regions ──────────────────────────────────────────────
  nuts_total_regions: { source: 'nuts', chart: 'stat', build: (d) => ({ value: (d?.total_regions ?? 0).toLocaleString(), label: 'Total Regions' }) },
  nuts_companies_linked: { source: 'nuts', chart: 'stat', build: (d) => ({ value: (d?.companies_linked ?? 0).toLocaleString(), label: 'Companies Linked' }) },
  nuts_authorities_linked: { source: 'nuts', chart: 'stat', build: (d) => ({ value: (d?.authorities_linked ?? 0).toLocaleString(), label: 'Authorities Linked' }) },
  nuts_coverage: { source: 'nuts', chart: 'gauge', build: (d) => ({ value: d ? Math.round(d.company_coverage_pct) : 0, label: 'Company Coverage' }) },
  nuts_top_regions: { source: 'nuts', chart: 'bar_h', build: (d) => ({ data: (d?.top_regions || []).map((r) => ({ label: `${r.code} — ${r.name}`, value: r.companies })), maxBars: 15 }) },
  nuts_by_level: { source: 'nuts', chart: 'bar_h', build: (d) => ({ data: (d?.by_level || []).map((l) => ({ label: `Level ${l.level}`, value: l.n })), maxBars: 4 }) },

  // ── Sanctions ─────────────────────────────────────────────────
  sanctions_total: { source: 'sanctions', chart: 'stat', build: (d) => ({ value: (d?.total ?? 0).toLocaleString(), label: 'Total Sanctioned Entities' }) },
  sanctions_persons: { source: 'sanctions', chart: 'stat', build: (d) => ({ value: (d?.persons ?? 0).toLocaleString(), label: 'Persons' }) },
  sanctions_entities: { source: 'sanctions', chart: 'stat', build: (d) => ({ value: (d?.entities ?? 0).toLocaleString(), label: 'Organisations' }) },
  sanctions_matched: { source: 'sanctions', chart: 'stat', build: (d) => ({ value: (d?.matched_to_companies ?? 0).toLocaleString(), label: 'Matched to Companies' }) },
  sanctions_match_rate: { source: 'sanctions', chart: 'gauge', build: (d) => ({ value: d ? Math.round((d.matched_to_companies / Math.max(d.total, 1)) * 100) : 0, label: 'Company Match Rate' }) },
  sanctions_top_regimes: { source: 'sanctions', chart: 'bar_h', build: (d) => ({ data: (d?.top_regimes || []).map((r) => ({ label: r.regime, value: r.n })), maxBars: 10 }) },

  // ── ESEF (XBRL filings) ───────────────────────────────────────
  esef_companies: { source: 'esef', chart: 'stat', build: (d) => ({ value: (d?.companies ?? 0).toLocaleString(), label: 'EU Companies' }) },
  esef_financial_years: { source: 'esef', chart: 'stat', build: (d) => ({ value: (d?.financial_years ?? 0).toLocaleString(), label: 'Financial Years' }) },
  esef_by_year: { source: 'esef', chart: 'ts_bar', build: (d) => ({ data: d?.by_year || [], valueLabel: 'Filings' }) },
  esef_by_country: { source: 'esef', chart: 'bar_h', build: (d) => ({ data: (d?.by_country || []).map((c) => ({ label: c.country, value: c.count })) }) },
  esef_field_coverage: { source: 'esef', chart: 'bar_h', build: (d) => ({ data: Object.entries(d?.field_coverage || {}).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v })), format: 'pct', color: '#16a34a' }) },

  // ── EU Knowledge Graph (cohesion projects) ────────────────────
  eukg_total_projects: { source: 'eu-knowledge-graph', chart: 'stat', build: (d) => ({ value: (d?.total_projects ?? 0).toLocaleString(), label: 'Total Projects' }) },
  eukg_beneficiary_links: { source: 'eu-knowledge-graph', chart: 'stat', build: (d) => ({ value: (d?.beneficiary_links ?? 0).toLocaleString(), label: 'Beneficiary Links' }) },
  eukg_eu_contribution: { source: 'eu-knowledge-graph', chart: 'stat', build: (d) => ({ value: d ? `€${(d.total_eu_contribution / 1e9).toFixed(2)}B` : '0', label: 'EU Contribution' }) },
  eukg_by_fund: { source: 'eu-knowledge-graph', chart: 'bar_h', build: (d) => ({ data: (d?.by_fund || []).map((f) => ({ label: f.fund, value: f.n })), maxBars: 10 }) },
  eukg_by_country: { source: 'eu-knowledge-graph', chart: 'bar_h', build: (d) => ({ data: (d?.by_country || []).map((c) => ({ label: c.country, value: c.n })), maxBars: 15 }) },

  // ── EDGAR (SEC filings) ───────────────────────────────────────
  edgar_companies: { source: 'edgar', chart: 'stat', build: (d) => ({ value: (d?.companies ?? 0).toLocaleString(), label: 'US Companies' }) },
  edgar_financial_years: { source: 'edgar', chart: 'stat', build: (d) => ({ value: (d?.financial_years ?? 0).toLocaleString(), label: 'Financial Years' }) },
  edgar_by_year: { source: 'edgar', chart: 'ts_bar', build: (d) => ({ data: d?.by_year || [], valueLabel: 'Filings' }) },
  edgar_field_coverage: { source: 'edgar', chart: 'bar_h', build: (d) => ({ data: Object.entries(d?.field_coverage || {}).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v })), format: 'pct', color: '#16a34a' }) },

  // ── CDP (climate disclosure) ──────────────────────────────────
  cdp_companies_with_score: { source: 'cdp', chart: 'stat', build: (d) => ({ value: (d?.companies_with_score ?? 0).toLocaleString(), label: 'Companies with CDP Score' }) },
  cdp_score_distribution: { source: 'cdp', chart: 'bar_h', build: (d) => ({ data: (d?.score_distribution || []).map((s) => ({ label: s.score, value: s.count })), maxBars: 10 }) },
  cdp_by_year: { source: 'cdp', chart: 'bar_h', build: (d) => ({ data: (d?.by_reporting_year || []).map((y) => ({ label: y.year, value: y.count })), maxBars: 10 }) },

  // ── Dedup (SAME_AS review) ────────────────────────────────────
  dedup_pending: { source: 'dedup', chart: 'stat', build: (d) => ({ value: d?.pending ?? 0, label: 'Pending Review', color: '#d97706' }) },
  dedup_reviewed: { source: 'dedup', chart: 'stat', build: (d) => ({ value: d?.reviewed ?? 0, label: 'Reviewed', color: '#16a34a' }) },
  dedup_total: { source: 'dedup', chart: 'stat', build: (d) => ({ value: d?.total ?? 0, label: 'Total SAME_AS' }) },

  // ── Trade edges ───────────────────────────────────────────────
  trade_pairs: { source: 'trade-edges', chart: 'stat', build: (d) => ({ value: (d?.trade_pairs ?? 0).toLocaleString(), label: 'Trade Pairs' }) },
  trade_total_eur: { source: 'trade-edges', chart: 'stat', build: (d) => ({ value: fmtEur(d?.total_eur), label: 'Total EUR Value' }) },
  trade_total_contracts: { source: 'trade-edges', chart: 'stat', build: (d) => ({ value: (d?.total_contracts ?? 0).toLocaleString(), label: 'Total Contracts' }) },

  // ── Connectedness ─────────────────────────────────────────────
  conn_total_nodes: { source: 'connectedness', chart: 'stat', build: (d) => ({ value: Number((d?.per_type || []).reduce((s, t) => s + (t.count || 0), 0)).toLocaleString(), label: 'Total Nodes' }) },
  conn_isolated: { source: 'connectedness', chart: 'stat', build: (d) => ({ value: Number((d?.per_type || []).reduce((s, t) => s + (t.isolated_count || 0), 0)).toLocaleString(), label: 'Isolated' }) },
  conn_isolated_pct: { source: 'connectedness', chart: 'stat', build: (d) => { const tn = (d?.per_type || []).reduce((s, t) => s + (t.count || 0), 0); const ti = (d?.per_type || []).reduce((s, t) => s + (t.isolated_count || 0), 0); const p = tn ? (ti / tn) * 100 : 0; return { value: `${p.toFixed(1)}%`, label: 'Isolated %' } } },
  conn_histogram: { source: 'connectedness', chart: 'bar_h', build: (d, dp) => { const t = (d?.per_type || []).find((x) => x.entity_type === dp?.entity_type); return { data: (t?.histogram || []).map((b) => ({ label: b.bucket, value: b.count })), maxBars: 8 } } },
  // ── Triples (RDF graph) ───────────────────────────────────────
  triples_total: { source: 'triples', chart: 'stat', build: (d) => ({ value: (d?.total_triples ?? 0).toLocaleString(), label: 'Total triples' }) },
  triples_graphs: { source: 'triples', chart: 'stat', build: (d) => ({ value: ((d?.graphs?.length) ?? 0).toLocaleString(), label: 'Named graphs' }) },
  triples_snapshot: { source: 'triples', chart: 'stat', build: (d) => ({ value: d?.generated_at ? new Date(d.generated_at).toLocaleString() : '—', label: 'Snapshot taken' }) },
  triples_graphs_bars: { source: 'triples', chart: 'bar_h', build: (d) => ({ data: (d?.graphs || []).map((g) => ({ label: g.label, value: g.triples })), maxBars: 20 }) },
  triples_classes: { source: 'triples', chart: 'bar_h', build: (d, dp) => { const sel = (d?.graphs || []).find((g) => g.iri === dp?.graph_iri); return { data: (sel?.classes || []).map((c) => ({ label: shortenIri(c.class), value: c.n })), maxBars: 15 } } },
  triples_predicates: { source: 'triples', chart: 'bar_h', build: (d, dp) => { const sel = (d?.graphs || []).find((g) => g.iri === dp?.graph_iri); return { data: (sel?.top_predicates || []).map((pr) => ({ label: shortenIri(pr.predicate), value: pr.n })), maxBars: 15 } } },

  // ── Overview (cross-source + country codes) ───────────────────
  overview_overlap_contracts_cohesion: { source: 'cross-source-overlap', chart: 'stat', build: (d) => ({ value: Number(d?.contracts_and_cohesion ?? 0).toLocaleString(), label: 'Contracts + Cohesion' }) },
  overview_overlap_contracts_lobby: { source: 'cross-source-overlap', chart: 'stat', build: (d) => ({ value: Number(d?.contracts_and_lobby ?? 0).toLocaleString(), label: 'Contracts + Lobby' }) },
  overview_overlap_listed_contracts: { source: 'cross-source-overlap', chart: 'stat', build: (d) => ({ value: Number(d?.listed_and_contracts ?? 0).toLocaleString(), label: 'Listed + Contracts' }) },
  overview_overlap_sanctions_matched: { source: 'cross-source-overlap', chart: 'stat', build: (d) => ({ value: Number(d?.sanctions_matched ?? 0).toLocaleString(), label: 'Sanctions Matched' }) },
  overview_alpha2_count: { source: 'country-codes', chart: 'stat', build: (d) => ({ value: Number(d?.alpha2_count ?? 0).toLocaleString(), label: 'Alpha-2 Codes' }) },
  overview_alpha3_count: { source: 'country-codes', chart: 'stat', build: (d) => ({ value: Number(d?.alpha3_count ?? 0).toLocaleString(), label: 'Alpha-3 Codes' }) },
  overview_other_count: { source: 'country-codes', chart: 'stat', build: (d) => ({ value: Number(d?.other_count ?? 0).toLocaleString(), label: 'Other Format' }) },
  overview_no_country_count: { source: 'country-codes', chart: 'stat', build: (d) => ({ value: Number(d?.no_country_count ?? 0).toLocaleString(), label: 'No Country' }) },
  overview_alpha3_pct: { source: 'country-codes', chart: 'gauge', build: (d) => { const t = (d?.alpha2_count || 0) + (d?.alpha3_count || 0) + (d?.other_count || 0); return { value: t ? Math.round((d.alpha3_count / t) * 100) : 0, label: 'Alpha-3 %' } } },
  overview_alpha2_pct: { source: 'country-codes', chart: 'gauge', build: (d) => { const t = (d?.alpha2_count || 0) + (d?.alpha3_count || 0) + (d?.other_count || 0); return { value: t ? Math.round((d.alpha2_count / t) * 100) : 0, label: 'Alpha-2 %' } } },
  overview_top_alpha2: { source: 'country-codes', chart: 'bar_h', build: (d) => ({ data: (d?.top_alpha2_codes || []).map((c) => ({ label: c.code, value: c.n })), maxBars: 10 }) },
}

export function dqChart(key) { return DQ_CHARTS[key] || null }
