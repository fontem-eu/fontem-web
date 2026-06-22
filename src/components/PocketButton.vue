<script setup>
/**
 * PocketButton — the shared "actions" affordance for any saved/exportable
 * visualization. Two render modes from one component:
 *
 *  - With a `captureTarget` (something that can be exported): a permanent
 *    "⋮" menu offering **Save to pocket** + **Download as image**. Used by
 *    charts, maps and the graph so the actions are consistent everywhere.
 *  - Without one: the original single "Save to pocket" button (unchanged),
 *    so callers that only save keep their existing look/behaviour.
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { usePocket } from '../composables/usePocket.js'
import { downloadElementAsImage } from '../utils/downloadViz.js'

const props = defineProps({
  widgetType: { type: String, required: true },
  config: { type: Object, required: true },
  defaultName: { type: String, default: '' },
  // Element / ref-getter / selector to export. Presence enables the
  // "Download as image" action and switches to the ⋮ menu layout.
  captureTarget: { type: [Object, Function, String], default: null },
})

const { save } = usePocket()
const menuMode = computed(() => props.captureTarget != null)

const menuOpen = ref(false)
const showPrompt = ref(false)
const nameInput = ref('')
const saved = ref(false)

function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu() { menuOpen.value = false }
function onDocClick(e) { if (!e.target.closest?.('.pocket-menu-wrap')) closeMenu() }
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

function openPrompt() {
  nameInput.value = props.defaultName
  closeMenu()
  showPrompt.value = true
}
function confirmSave() {
  save(props.widgetType, props.config, nameInput.value.trim() || props.defaultName)
  showPrompt.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}
function cancelSave() { showPrompt.value = false }

function resolveTarget() {
  const t = props.captureTarget
  if (!t) return null
  if (typeof t === 'function') return t()
  if (typeof t === 'string') return document.querySelector(t)
  return t
}
function downloadImage() {
  closeMenu()
  downloadElementAsImage(resolveTarget(), props.defaultName || props.widgetType)
}
</script>

<template>
  <span class="pocket-wrapper">
    <!-- ⋮ actions menu (save + download) -->
    <span v-if="menuMode" class="pocket-menu-wrap">
      <button
        type="button"
        class="pocket-menu-btn"
        data-testid="pocket-menu-btn"
        :aria-expanded="menuOpen"
        :aria-label="$t('pocket_button.chart_actions')"
        :title="$t('pocket_button.chart_actions')"
        @click.stop="toggleMenu"
      >⋮</button>
      <div v-if="menuOpen" class="pocket-menu" data-testid="pocket-menu" role="menu">
        <button
          type="button"
          class="pocket-menu-item"
          data-testid="pocket-save-btn"
          role="menuitem"
          @click="openPrompt"
        >{{ saved ? $t('pocket_button.saved') : $t('pocket_button.save_to_pocket') }}</button>
        <button
          type="button"
          class="pocket-menu-item"
          data-testid="pocket-download-btn"
          role="menuitem"
          @click="downloadImage"
        >{{ $t('pocket_button.download_image') }}</button>
      </div>
    </span>

    <!-- legacy single save button (no export target) -->
    <button
      v-else
      class="pocket-btn"
      :class="{ 'pocket-saved': saved }"
      data-testid="pocket-save-btn"
      :title="saved ? $t('pocket_button.saved_to_pocket_tooltip') : $t('pocket_button.save_to_pocket_tooltip')"
      @click="openPrompt"
    >
      <svg v-if="!saved" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <span class="pocket-label">{{ saved ? $t('pocket_button.saved') : $t('pocket_button.pocket') }}</span>
    </button>

    <!-- Name prompt overlay (shared by both modes) -->
    <div v-if="showPrompt" class="pocket-prompt" data-testid="pocket-prompt">
      <div class="pocket-prompt-card" @click.stop>
        <label for="pocket-name-input" class="pocket-prompt-label">{{ $t('pocket_button.save_to_pocket') }}</label>
        <input
          id="pocket-name-input"
          v-model="nameInput"
          type="text"
          class="pocket-prompt-input"
          :placeholder="defaultName || $t('pocket_button.name_this_snapshot')"
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
  </span>
</template>

<style scoped>
.pocket-wrapper { position: relative; display: inline-flex; }

/* ── ⋮ menu mode ── */
.pocket-menu-wrap { position: relative; display: inline-flex; }
.pocket-menu-btn {
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
.pocket-menu-btn:hover,
.pocket-menu-btn[aria-expanded="true"] {
  color: var(--accent);
  border-color: var(--border);
  background: var(--surface);
}
.pocket-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 30;
  min-width: 170px;
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
.pocket-menu-item {
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
.pocket-menu-item:hover { background: var(--bg); color: var(--accent); }

/* ── legacy button mode ── */
.pocket-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.pocket-btn:hover { border-color: var(--accent); color: var(--accent); }
.pocket-saved { color: var(--accent); border-color: var(--accent); }
.pocket-label { line-height: 1; }

/* ── name prompt ── */
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
