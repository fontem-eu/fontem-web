<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  /** Label shown on the collapsed button */
  label: { type: String, required: true },
  /** Record of { key: boolean } — v-model */
  modelValue: { type: Object, required: true },
  /** Optional color map: { key: '#hex' } for color dots */
  colors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const container = ref(null)

const activeCount = computed(() =>
  Object.values(props.modelValue).filter(Boolean).length,
)
const totalCount = computed(() => Object.keys(props.modelValue).length)

function toggle(key) {
  emit('update:modelValue', { ...props.modelValue, [key]: !props.modelValue[key] })
}

function selectAll() {
  const next = {}
  for (const k of Object.keys(props.modelValue)) next[k] = true
  emit('update:modelValue', next)
}

function selectNone() {
  const next = {}
  for (const k of Object.keys(props.modelValue)) next[k] = false
  emit('update:modelValue', next)
}

function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="container" class="ms" data-testid="multi-select">
    <button
      class="ms__trigger"
      :data-testid="`ms-trigger-${label.toLowerCase()}`"
      @click.stop="open = !open"
    >
      <span class="ms__label">{{ label }}</span>
      <span class="ms__count">{{ activeCount }}/{{ totalCount }}</span>
      <svg
        class="ms__chevron"
        :class="{ 'ms__chevron--open': open }"
        width="10" height="10" viewBox="0 0 10 10"
        fill="currentColor"
      >
        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>

    <div v-if="open" class="ms__dropdown" data-testid="ms-dropdown">
      <div class="ms__actions">
        <button class="ms__action" data-testid="ms-all" @click="selectAll">{{ $t('app.all') }}</button>
        <button class="ms__action" data-testid="ms-none" @click="selectNone">{{ $t('multi_select.none') }}</button>
      </div>
      <label
        v-for="(checked, key) in modelValue"
        :key="key"
        class="ms__item"
        :data-testid="`ms-item-${String(key).toLowerCase()}`"
      >
        <input
          type="checkbox"
          :checked="checked"
          @change="toggle(key)"
        />
        <span
          v-if="colors[key]"
          class="ms__dot"
          :style="{ background: colors[key] }"
        ></span>
        {{ key }}
      </label>
    </div>
  </div>
</template>

<style scoped>
.ms {
  position: relative;
}

.ms__trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  border-radius: 3px;
  white-space: nowrap;
}

.ms__trigger:hover {
  border-color: var(--accent);
}

.ms__label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  font-size: 10px;
}

.ms__count {
  font-size: 10px;
  color: var(--muted);
}

.ms__chevron {
  color: var(--muted);
  transition: transform 0.15s;
}

.ms__chevron--open {
  transform: rotate(180deg);
}

.ms__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  min-width: 160px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 4px 0;
}

.ms__actions {
  display: flex;
  gap: 4px;
  padding: 4px 8px 6px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2px;
}

.ms__action {
  font-size: 10px;
  color: var(--accent);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-weight: 600;
}

.ms__action:hover {
  text-decoration: underline;
}

.ms__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  color: var(--text);
}

.ms__item:hover {
  background: var(--surface);
}

.ms__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
