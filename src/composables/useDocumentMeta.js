import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const ROUTE_TO_KEY = {
  '/': 'home',
  '/about': 'about',
  '/privacy': 'privacy',
  '/data-quality': 'data_quality',
  '/sparql': 'sparql',
  '/development': 'development',
  '/map': 'map',
  '/spending': 'spending',
  '/login': 'login',
}

function setDescriptionMeta(text) {
  if (typeof document === 'undefined') return
  let el = document.querySelector('meta[name="description"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'description')
    document.head.appendChild(el)
  }
  el.setAttribute('content', text)
}

export function useDocumentMeta() {
  if (typeof document === 'undefined') return
  const route = useRoute()
  const { t, locale } = useI18n()

  const apply = () => {
    const key = ROUTE_TO_KEY[route.path]
    if (!key) return
    const title = t(`meta.title.${key}`)
    const desc = t(`meta.description.${key}`)
    if (title) document.title = title
    if (desc) setDescriptionMeta(desc)
  }

  onMounted(apply)
  const stop = watch([() => route.path, locale], apply)
  onUnmounted(stop)
}
