/**
 * Client viz registry: maps a viz `type` to the fontem-api endpoint that
 * returns its plot-ready data. This is the *only* place a type is bound to a
 * data source on the client. A saved viz stores {type, data_params, ui_params};
 * the wrapper looks the type up here and fetches — it never carries data.
 */
export const VIZ_ENDPOINTS = {
  company_bidder_breakdown: (dp) =>
    `/api/viz/company-bidder-breakdown?entity_id=${encodeURIComponent(dp.entity_id || '')}`,
}

export function resolveVizEndpoint(type, dataParams) {
  const build = VIZ_ENDPOINTS[type]
  return build ? build(dataParams || {}) : null
}
