<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  groups: { type: Array, required: true },
  // groups: [{ key, label, views: [{ key, label }] }]
})

defineEmits(['update:modelValue'])


// Find which group the current view belongs to
const activeGroup = computed(() => {
  for (const g of props.groups) {
    if (g.views.some((v) => v.key === props.modelValue)) return g.key
  }
  return props.groups[0]?.key
})

const activeGroupViews = computed(() => {
  const g = props.groups.find((g) => g.key === activeGroup.value)
  return g?.views || []
})

// Mobile: flat list for dropdown
const allViews = computed(() => {
  const result = []
  for (const g of props.groups) {
    for (const v of g.views) {
      result.push({ ...v, groupLabel: g.label })
    }
  }
  return result
})

const mobileOpen = ref(false)
const currentLabel = computed(() => {
  const v = allViews.value.find((v) => v.key === props.modelValue)
  return v ? `${v.groupLabel} › ${v.label}` : props.modelValue
})
</script>

<template>
  <div class="dvs" data-testid="view-selector">
    <!-- Desktop: two-level nav -->
    <nav class="dvs-desktop" :aria-label="$t('data_view_selector.data_view')">
      <!-- Category row -->
      <div class="dvs-categories">
        <button
          v-for="g in groups"
          :key="g.key"
          type="button"
          class="dvs-cat"
          :class="{
            'dvs-cat--active': activeGroup === g.key,
            'dvs-cat--disabled': g.disabled,
          }"
          :data-testid="`view-cat-${g.key}`"
          :disabled="g.disabled"
          :aria-disabled="g.disabled || undefined"
          :title="g.disabled && g.disabledReason ? g.disabledReason : undefined"
          @click="g.disabled ? null : $emit('update:modelValue', g.views[0].key)"
        >
          {{ g.label }}
        </button>
      </div>
      <!-- Sub-view row -->
      <div class="dvs-views">
        <button
          v-for="v in activeGroupViews"
          :key="v.key"
          type="button"
          class="dvs-view"
          :class="{ 'dvs-view--active': modelValue === v.key }"
          :data-testid="`view-opt-${v.key}`"
          :aria-current="modelValue === v.key ? 'page' : undefined"
          @click="$emit('update:modelValue', v.key)"
        >
          {{ v.label }}
          <span
            v-if="v.key === 'gmr-long'"
            class="dvs-info"
            :title="$t('data_view_selector.gmr_long_tooltip')"
            data-testid="gmr-long-info"
            @click.stop
          >ⓘ</span>
        </button>
      </div>
    </nav>

    <!-- Mobile: dropdown -->
    <div class="dvs-mobile">
      <button
        type="button"
        class="dvs-dropdown-btn"
        data-testid="view-dropdown-btn"
        @click="mobileOpen = !mobileOpen"
      >
        {{ currentLabel }}
        <span class="dvs-chevron">{{ mobileOpen ? '▴' : '▾' }}</span>
      </button>
      <div v-if="mobileOpen" class="dvs-dropdown" data-testid="view-dropdown">
        <template v-for="g in groups" :key="g.key">
          <div
            class="dvs-dropdown-group"
            :class="{ 'dvs-dropdown-group--disabled': g.disabled }"
          >{{ g.label }}{{ g.disabled ? ' (no data)' : '' }}</div>
          <button
            v-for="v in g.views"
            :key="v.key"
            type="button"
            class="dvs-dropdown-item"
            :class="{
              'dvs-dropdown-item--active': modelValue === v.key,
              'dvs-dropdown-item--disabled': g.disabled,
            }"
            :data-testid="`view-opt-${v.key}`"
            :disabled="g.disabled"
            :aria-disabled="g.disabled || undefined"
            @click="g.disabled ? null : ($emit('update:modelValue', v.key), mobileOpen = false)"
          >
            {{ v.label }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Desktop: two-level horizontal nav ── */
.dvs-desktop { display: none; }
@media (min-width: 640px) {
  .dvs-desktop { display: flex; flex-direction: column; gap: 0; min-width: 150px; }
}

.dvs-categories { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; border-bottom: 1px solid var(--border); }
.dvs-cat {
  padding: 6px 12px; border: none; background: none; text-align: left;
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--muted); cursor: pointer; border-radius: 4px;
}
.dvs-cat:hover { color: var(--text); background: var(--surface); }
.dvs-cat--active { color: var(--accent); }
.dvs-cat--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dvs-cat--disabled:hover {
  color: var(--muted);
  background: none;
}

.dvs-views { display: flex; flex-direction: column; gap: 1px; padding: 4px 0; }
.dvs-view {
  padding: 7px 12px 7px 20px; border: none; background: none; text-align: left;
  font-size: 0.8125rem; font-weight: 500; color: var(--muted); cursor: pointer; border-radius: 4px;
}
.dvs-view:hover { background: var(--surface); color: var(--text); }
.dvs-view--active { background: var(--surface); color: var(--accent); font-weight: 600; }

.dvs-info { margin-left: 3px; font-size: 0.7rem; color: var(--muted); opacity: 0.7; cursor: help; }

/* ── Mobile: dropdown ── */
.dvs-mobile { display: block; }
@media (min-width: 640px) { .dvs-mobile { display: none; } }

.dvs-dropdown-btn {
  width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); color: var(--text); font-size: 0.85rem; font-weight: 600;
  cursor: pointer; display: flex; justify-content: space-between; align-items: center;
}
.dvs-chevron { font-size: 0.75rem; color: var(--muted); }

.dvs-dropdown {
  position: absolute; z-index: 100; left: 0; right: 0; margin-top: 4px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden;
}
.dvs-dropdown-group {
  padding: 6px 12px 2px; font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted);
}
.dvs-dropdown-item {
  display: block; width: 100%; padding: 8px 12px 8px 24px; border: none;
  background: none; text-align: left; font-size: 0.85rem; color: var(--text); cursor: pointer;
}
.dvs-dropdown-item:hover { background: var(--surface); }
.dvs-dropdown-item--active { color: var(--accent); font-weight: 600; }
.dvs-dropdown-item--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dvs-dropdown-item--disabled:hover { background: none; }
.dvs-dropdown-group--disabled { opacity: 0.55; }
</style>
