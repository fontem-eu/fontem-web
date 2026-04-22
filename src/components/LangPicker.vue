<script setup>
import { useLang } from '../composables/useLang.js'
import { EU_LANGUAGES } from '../composables/eu-languages.js'

const { lang, setLang } = useLang()

function onChange(event) {
  setLang(event.target.value)
}
</script>

<template>
  <label class="gmr-lang-picker">
    <span class="visually-hidden">Language</span>
    <select
      class="gmr-lang-picker__select"
      :value="lang"
      aria-label="Language"
      data-testid="lang-picker"
      @change="onChange"
    >
      <option v-for="l in EU_LANGUAGES" :key="l.code" :value="l.code">
        {{ l.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.gmr-lang-picker {
  display: inline-flex;
  align-items: center;
}
.gmr-lang-picker__select {
  appearance: none;
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 2px 22px 2px 6px;
  font-size: 0.85rem;
  line-height: 1.2;
  cursor: pointer;
  /* Minimal chevron — same stroke as ThemeToggle */
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='1,1 5,5 9,1'/></svg>");
  background-repeat: no-repeat;
  background-position: right 6px center;
}
:global(html.dark) .gmr-lang-picker__select {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%23fff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='1,1 5,5 9,1'/></svg>");
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
