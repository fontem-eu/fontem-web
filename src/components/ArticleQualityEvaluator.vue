<script setup>
/**
 * Article-quality evaluator. A button that scores the current story against two
 * house-style heuristics and renders them as two bars plus concrete
 * suggestions. Pure client-side: it reads the passed Tiptap doc via
 * utils/articleQuality -- no server round-trip.
 *
 *  - Reading time: aim for ~10 minutes.
 *  - Data-to-text balance: prose should be ~half the reading time of the data.
 */
import { ref, computed } from 'vue'
import { evaluateQuality } from '../utils/articleQuality.js'

const props = defineProps({
  // Static doc (used by tests). In the editor, prefer getDoc so the CURRENT
  // (possibly unsaved) content is read at click time.
  doc: { type: Object, default: null },
  getDoc: { type: Function, default: null },
})

const result = ref(null)

function evaluate() {
  const doc = (typeof props.getDoc === 'function' ? props.getDoc() : props.doc)
    || { type: 'doc', content: [] }
  result.value = evaluateQuality(doc)
}

const readingVerdict = computed(() => {
  if (!result.value) return null
  const { totalMinutes, config } = result.value
  if (totalMinutes < config.targetMinutes - config.minutesTolerance) return 'too_short'
  if (totalMinutes > config.targetMinutes + config.minutesTolerance) return 'too_long'
  return 'ok'
})

const balanceVerdict = computed(() => {
  if (!result.value) return null
  const { dataMinutes, ratio, config } = result.value
  if (dataMinutes <= 0) return 'no_data'
  if (ratio > config.targetTextDataRatio + config.ratioTolerance) return 'too_much_text'
  if (ratio < config.targetTextDataRatio - config.ratioTolerance) return 'too_much_data'
  return 'balanced'
})

function pct(score) {
  return Math.round((Number(score) || 0) * 100)
}

function tone(score) {
  if (score >= 0.7) return 'good'
  if (score >= 0.4) return 'warn'
  return 'bad'
}
</script>

<template>
  <div class="article-quality" data-testid="article-quality">
    <button
      type="button"
      class="aq-btn"
      data-testid="evaluate-quality-btn"
      @click="evaluate"
    >
      {{ $t('article_quality.button') }}
    </button>

    <div v-if="result" class="aq-report" data-testid="quality-report">
      <div class="aq-metric" data-testid="quality-bar-reading-time">
        <div class="aq-metric-head">
          <span class="aq-label">{{ $t('article_quality.reading_time_label') }}</span>
          <span class="aq-value" data-testid="reading-time-value">
            {{ $t('article_quality.minutes', { n: result.totalMinutes }) }}
            &middot; {{ $t(`article_quality.verdict.${readingVerdict}`) }}
          </span>
        </div>
        <div class="aq-track">
          <div
            class="aq-fill"
            :class="tone(result.readingTimeScore)"
            :style="{ width: pct(result.readingTimeScore) + '%' }"
            :data-tone="tone(result.readingTimeScore)"
            data-testid="reading-time-fill"
          ></div>
        </div>
      </div>

      <div class="aq-metric" data-testid="quality-bar-balance">
        <div class="aq-metric-head">
          <span class="aq-label">{{ $t('article_quality.balance_label') }}</span>
          <span class="aq-value" data-testid="balance-value">
            {{ $t(`article_quality.verdict.${balanceVerdict}`) }}
          </span>
        </div>
        <div class="aq-track">
          <div
            class="aq-fill"
            :class="tone(result.balanceScore)"
            :style="{ width: pct(result.balanceScore) + '%' }"
            :data-tone="tone(result.balanceScore)"
            data-testid="balance-fill"
          ></div>
        </div>
      </div>

      <ul
        v-if="result.suggestions.length"
        class="aq-suggestions"
        data-testid="quality-suggestions"
      >
        <li
          v-for="s in result.suggestions"
          :key="s"
          data-testid="quality-suggestion"
        >
          {{ $t(`article_quality.suggestion.${s}`) }}
        </li>
      </ul>
      <p v-else class="aq-ok" data-testid="quality-ok">
        {{ $t('article_quality.all_good') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.article-quality { display: flex; flex-direction: column; gap: 0.5rem; }
.aq-btn {
  align-self: flex-start;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.aq-btn:hover { background: var(--surface-hover, var(--surface)); }
.aq-report { display: flex; flex-direction: column; gap: 0.6rem; }
.aq-metric { display: flex; flex-direction: column; gap: 0.2rem; }
.aq-metric-head { display: flex; justify-content: space-between; font-size: 0.85rem; }
.aq-label { font-weight: 600; }
.aq-value { color: var(--text-muted, var(--text)); }
.aq-track { height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
.aq-fill { height: 100%; transition: width 0.2s ease; }
.aq-fill.good { background: var(--success, #2e7d32); }
.aq-fill.warn { background: var(--warning, #ed9c00); }
.aq-fill.bad  { background: var(--danger, #c62828); }
.aq-suggestions { margin: 0; padding-left: 1.1rem; font-size: 0.85rem; }
.aq-suggestions li { margin: 0.15rem 0; }
.aq-ok { font-size: 0.85rem; color: var(--success, #2e7d32); margin: 0; }
</style>
