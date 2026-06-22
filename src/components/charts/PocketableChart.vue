<script setup>
/**
 * PocketableChart — wraps any chart primitive (via ChartSpec) and adds a
 * permanent "⋮" actions menu in a slim header row above the chart. The
 * header keeps the menu out of the chart's own controls (e.g. the
 * time-series granularity selector), which the old hover overlay used to
 * cover. Menu actions:
 *   - Save to pocket  — snapshot the chart (config built from the same
 *     props that render it, so what you save is what you see)
 *   - Download as image — SVG when the chart is vector (d3/svg), else PNG
 *     from the canvas, else a text snapshot for stat tiles
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import ChartSpec from './ChartSpec.vue'
import { usePocket } from '../../composables/usePocket.js'
import { serializeChartProps } from '../../widgets/chartSnapshot.js'

const props = defineProps({
  chart: { type: String, required: true },
  chartProps: { type: Object, default: () => ({}) },
  name: { type: String, default: '' },
  // Save is offered only when savable; download is always available.
  savable: { type: Boolean, default: true },
})

const { save } = usePocket()
const bodyRef = ref(null)
const menuOpen = ref(false)
const showPrompt = ref(false)
const nameInput = ref('')
const saved = ref(false)

const snapshotConfig = computed(() => ({
  chart: props.chart,
  props: serializeChartProps(props.chartProps),
  title: props.name,
}))

function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu() { menuOpen.value = false }

// Close the menu on an outside click or Escape.
function onDocClick(e) {
  if (!e.target.closest?.('.pc-menu-wrap')) closeMenu()
}
function onKey(e) { if (e.key === 'Escape') closeMenu() }
watch(menuOpen, (open) => {
  const m = open ? 'addEventListener' : 'removeEventListener'
  document[m]('click', onDocClick, true)
  document[m]('keydown', onKey, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onKey, true)
})

// ── Save to pocket ────────────────────────────────────────────────
function openSavePrompt() {
  nameInput.value = props.name
  closeMenu()
  showPrompt.value = true
}
function confirmSave() {
  save('chart_snapshot', snapshotConfig.value, nameInput.value.trim() || props.name)
  showPrompt.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}
function cancelSave() { showPrompt.value = false }

// ── Download as image ─────────────────────────────────────────────
function safeName() {
  return (props.name || props.chart || 'chart').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'chart'
}
function triggerDownload(href, filename, revoke) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1000)
}
function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ))
}
function downloadImage() {
  closeMenu()
  const root = bodyRef.value
  if (!root) return
  const base = safeName()
  const svg = root.querySelector('svg')
  if (svg) {
    const clone = svg.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const data = new XMLSerializer().serializeToString(clone)
    const url = URL.createObjectURL(
      new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${data}`], { type: 'image/svg+xml' }),
    )
    triggerDownload(url, `${base}.svg`, true)
    return
  }
  const canvas = root.querySelector('canvas')
  if (canvas) {
    try { triggerDownload(canvas.toDataURL('image/png'), `${base}.png`) } catch { /* tainted */ }
    return
  }
  // No vector/canvas content (e.g. a stat tile) — snapshot its text as SVG.
  const lines = (root.innerText || '').trim().split('\n').map((s) => s.trim()).filter(Boolean)
  const w = 320
  const lh = 26
  const pad = 18
  const h = pad * 2 + lh * (lines.length || 1)
  const texts = lines.map((t, i) =>
    `<text x="${w / 2}" y="${pad + lh * (i + 1) - 6}" text-anchor="middle" `
    + `font-family="sans-serif" font-size="${i === 0 ? 22 : 13}" fill="#111">${escapeXml(t)}</text>`,
  ).join('')
  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    + `<rect width="100%" height="100%" fill="#ffffff"/>${texts}</svg>`
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }))
  triggerDownload(url, `${base}.svg`, true)
}
</script>

<template>
  <div class="pocketable-chart" data-testid="pocketable-chart">
    <div class="pc-toolbar">
      <div class="pc-menu-wrap">
        <button
          type="button"
          class="pc-menu-btn"
          data-testid="chart-menu-btn"
          :aria-expanded="menuOpen"
          :aria-label="$t('pocket_button.chart_actions')"
          :title="$t('pocket_button.chart_actions')"
          @click.stop="toggleMenu"
        >⋮</button>
        <div v-if="menuOpen" class="pc-menu" data-testid="chart-menu" role="menu">
          <button
            v-if="savable"
            type="button"
            class="pc-menu-item"
            data-testid="pocket-save-btn"
            role="menuitem"
            @click="openSavePrompt"
          >{{ saved ? $t('pocket_button.saved') : $t('pocket_button.save_to_pocket') }}</button>
          <button
            type="button"
            class="pc-menu-item"
            data-testid="chart-download-btn"
            role="menuitem"
            @click="downloadImage"
          >{{ $t('pocket_button.download_image') }}</button>
        </div>
      </div>
    </div>

    <div ref="bodyRef" class="pc-body">
      <ChartSpec :chart="chart" :chart-props="chartProps" />
    </div>

    <!-- Save-to-pocket name prompt -->
    <div v-if="showPrompt" class="pocket-prompt" data-testid="pocket-prompt">
      <div class="pocket-prompt-card" @click.stop>
        <label for="pc-name-input" class="pocket-prompt-label">{{ $t('pocket_button.save_to_pocket') }}</label>
        <input
          id="pc-name-input"
          v-model="nameInput"
          type="text"
          class="pocket-prompt-input"
          :placeholder="name || $t('pocket_button.name_this_snapshot')"
          data-testid="pocket-name-input"
          @keydown.enter="confirmSave"
          @keydown.escape="cancelSave"
        />
        <div class="pocket-prompt-actions">
          <button class="pocket-cancel" @click="cancelSave">{{ $t('app.cancel') }}</button>
          <button class="pocket-confirm" data-testid="pocket-confirm" @click="confirmSave">{{ $t('pocket_button.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pocketable-chart { position: relative; }

.pc-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 20px;
  margin-bottom: 2px;
}

.pc-menu-wrap { position: relative; }

.pc-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.pc-menu-btn:hover,
.pc-menu-btn[aria-expanded="true"] {
  color: var(--accent);
  border-color: var(--border);
  background: var(--surface);
}

.pc-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 20;
  min-width: 168px;
  margin-top: 2px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.pc-menu-item {
  text-align: left;
  padding: 0.4rem 0.6rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}
.pc-menu-item:hover { background: var(--bg); color: var(--accent); }

/* Name prompt — mirrors PocketButton's prompt. */
.pocket-prompt {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.pocket-prompt-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  width: 90%;
  max-width: 340px;
}
.pocket-prompt-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.5rem;
}
.pocket-prompt-input {
  display: block;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.8rem;
  outline: none;
  box-sizing: border-box;
}
.pocket-prompt-input:focus { border-color: var(--accent); }
.pocket-prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.pocket-cancel,
.pocket-confirm {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
}
.pocket-confirm { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
