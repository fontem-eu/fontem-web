# GMR Web

Vue 3 single-page application for exploring stock fundamentals and price history powered by the [edgar-gmr-etl](../edgar-gmr-etl) API.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 (`<script setup>`), Vite, Tailwind CSS |
| Charts | D3.js v7 (candlestick + volume) |
| Routing | Vue Router 4 |
| Testing | Vitest + @vue/test-utils, Playwright (e2e) |
| Serving | nginx (static build) |
| Deployment | Helm + kubectl (`make all`) |

## Local development

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
                     # proxies /api → https://gmr.void42.net
```

## Running tests

```bash
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright e2e (requires BASE_URL env)
npm run lint         # ESLint
```

## Building & deploying

```bash
make all             # docker build → push → helm upgrade → rollout restart
```

---

## Monitoring & Observability

The application is monitored through two complementary self-hosted systems.
**No data leaves the cluster.**

---

### 1 — API metrics: Prometheus + Grafana

Every HTTP request to the FastAPI backend (`gmr-api`) is automatically
instrumented by
[prometheus-fastapi-instrumentator](https://github.com/trallnag/prometheus-fastapi-instrumentator).

**What is collected**

| Metric | Description |
|--------|-------------|
| `http_requests_total` | Request count by endpoint, method, status class |
| `http_request_duration_seconds` | Latency histogram (p50 / p95 / p99) |
| `http_requests_in_progress` | Concurrent in-flight requests |
| Python GC / process metrics | Memory, GC pause times |

**Where to look**

| Dashboard | URL |
|-----------|-----|
| Grafana — GMR API | http://monitor.void42.internal/d/gmr-api-v1 |
| Raw Prometheus | http://monitor.void42.internal (Prometheus data source) |

The **GMR API** dashboard (auto-provisioned via ConfigMap) shows:
- Request rate per endpoint (time series)
- p95 latency per endpoint (time series)
- 5xx error rate (time series)
- In-flight requests (time series)
- 24 h summary stats: total requests, error %, median latency, p99 latency
- Requests by endpoint — bar chart

**How scraping works**

A `ServiceMonitor` in the `gmr` namespace (label `release: monitoring-stack`)
tells the kube-prometheus-stack operator to scrape `http://gmr-api.gmr:80/metrics`
every 15 s.

---

### 2 — UI analytics: Umami

[Umami](https://umami.is) is a lightweight, privacy-first, self-hosted
analytics platform. It tracks page views and custom events without any
third-party scripts or cookies.

**Where to look**

| | URL |
|--|-----|
| Umami dashboard | http://analytics.void42.internal |
| Default credentials | `admin` / `umami` (change on first login) |

**What is tracked automatically**

| Event | Trigger |
|-------|---------|
| Page view | Every Vue Router navigation |
| `ticker-selected` | User clicks or keyboard-selects a search result |
| `view-changed` | User switches between Summary / Income / GMR Long / … tabs |

Custom events are fired from `src/composables/useAnalytics.js` via
`window.umami.track()`. The composable is a no-op if the website ID is not
configured (e.g. in local dev).

**First-time setup after Umami is deployed**

1. Log in at http://analytics.void42.internal (`admin` / `umami`).
2. Change the admin password.
3. Go to **Settings → Websites → Add website**.
   - Name: `GMR Web`
   - Domain: `gmr.void42.net`
4. Copy the **Website ID** (UUID) shown in the tracking code snippet.
5. Patch the ConfigMap with the real ID:
   ```bash
   kubectl -n gmr patch configmap gmr-web-umami-config \
     --type merge \
     --patch '{"data":{"umami-config.js":"window.UMAMI_WEBSITE_ID=\"<YOUR-ID-HERE>\";\nwindow.UMAMI_SRC=\"http://analytics.void42.internal/script.js\";\n"}}'
   kubectl -n gmr rollout restart deployment gmr-web
   ```
6. Navigate to the app and check the Umami **Realtime** tab — you should see
   your page view appear within seconds.

> The website ID is stored in the `gmr-web-umami-config` ConfigMap (Helm
> template: `deployment/templates/umami-config.yaml`). Updating it does **not**
> require rebuilding the Docker image.

---

### 3 — ETL data freshness: `/api/v1/health/data`

The backend exposes a health endpoint that reports how fresh the locally
stored EDGAR and price data is:

```
GET /api/v1/health/data
```

Example response:

```json
{
  "status": "ok",
  "edgar": {
    "companyfacts_count": 12543,
    "reference_last_modified": "2025-01-15T10:23:00Z"
  },
  "prices": {
    "csv_count": 10416,
    "newest_file_modified": "2025-01-15T09:00:00Z",
    "newest_price_date": "2025-01-14"
  }
}
```

`status` is `"ok"` when both stores contain data, `"empty"` when one or
both are unpopulated (e.g. after a fresh deployment before the ETL jobs run).
