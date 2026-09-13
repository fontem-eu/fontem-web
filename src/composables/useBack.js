/**
 * Where "back" actually goes.
 *
 * Detail views used to offer a hardcoded link home — the contract page
 * sent everyone to /spending regardless of where they had come from,
 * and because it was a RouterLink it *pushed* a new entry rather than
 * popping one, so every visit made the real previous page one step
 * further away.
 *
 * The browser already knows the answer. `createWebHistory` keeps a real
 * history stack, and vue-router records the previous entry's path in
 * `history.state.back`. It is null exactly when there is nothing to go
 * back to — someone opening a shared contract link in a fresh tab —
 * which is the case the hardcoded link was clumsily covering. So: pop
 * when there is history, and fall back to a declared destination when
 * there is not.
 */
import { useRouter } from 'vue-router'

/**
 * True when the previous history entry is a path inside this app.
 *
 * Guards on a leading "/" so a foreign URL can never be treated as an
 * in-app entry, and rejects "//host" — protocol-relative, and off-site
 * despite the leading slash.
 */
export function hasInAppHistory(state) {
  const back = state?.back
  return typeof back === 'string' && back.startsWith('/') && !back.startsWith('//')
}

export function useBack(fallback = '/') {
  const router = useRouter()

  // Read once, at setup: the entry behind this view does not change
  // while the view is on screen, and history.state is not reactive
  // anyway, so a computed would only look like it tracked it.
  const cameFromApp = hasInAppHistory(router.options.history.state)

  function goBack() {
    if (cameFromApp) router.back()
    else router.push(fallback)
  }

  return { goBack, cameFromApp }
}
