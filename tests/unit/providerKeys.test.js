/**
 * Bring-your-own provider keys.
 *
 * The property that matters most is negative: the key must never come
 * back out. A UI that helpfully re-displays a stored key would undo the
 * write-only design on the server side of it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ProviderKeysCard from '../../src/components/ProviderKeysCard.vue'
import * as api from '../../src/api/community.js'

const CREDS = {
  supported: ['anthropic', 'mistral', 'openai'],
  credentials: [
    { provider: 'anthropic', model: null, fingerprint: 'a1b2c3d4',
      created_at: '2026-08-01T00:00:00Z', last_used_at: null },
  ],
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'listProviderCredentials').mockResolvedValue(CREDS)
  vi.spyOn(api, 'putProviderCredential').mockResolvedValue({})
  vi.spyOn(api, 'deleteProviderCredential').mockResolvedValue({})
})

describe('ProviderKeysCard', () => {
  it('shows which key is stored by fingerprint, never the key', async () => {
    const w = mount(ProviderKeysCard)
    await flushPromises()
    expect(w.get('[data-testid="provider-fingerprint"]').text()).toContain('a1b2c3d4')
    // Nothing in the rendered output may look like key material.
    expect(w.html()).not.toMatch(/sk-[A-Za-z0-9]/)
  })

  it('sends the key and then clears it from the DOM', async () => {
    const w = mount(ProviderKeysCard)
    await flushPromises()
    await w.get('[data-testid="provider-key-input"]').setValue('sk-ant-secret-value')
    await w.get('[data-testid="provider-key-save"]').trigger('submit')
    await flushPromises()
    expect(api.putProviderCredential).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-ant-secret-value' }),
    )
    // No reason for it to linger in a DOM node once sent.
    expect(w.get('[data-testid="provider-key-input"]').element.value).toBe('')
    expect(w.html()).not.toContain('sk-ant-secret-value')
  })

  it('the key field is a password input, not plain text', async () => {
    const w = mount(ProviderKeysCard)
    await flushPromises()
    expect(w.get('[data-testid="provider-key-input"]').attributes('type')).toBe('password')
  })

  it('refuses to submit an empty key', async () => {
    const w = mount(ProviderKeysCard)
    await flushPromises()
    await w.get('[data-testid="provider-key-save"]').trigger('submit')
    await flushPromises()
    expect(api.putProviderCredential).not.toHaveBeenCalled()
    expect(w.get('[data-testid="provider-key-error"]').text()).toMatch(/enter an api key/i)
  })

  it('says plainly when nothing is configured', async () => {
    vi.spyOn(api, 'listProviderCredentials').mockResolvedValue({ supported: ['mistral'], credentials: [] })
    const w = mount(ProviderKeysCard)
    await flushPromises()
    expect(w.get('[data-testid="provider-keys-empty"]').text()).toMatch(/assistant is unavailable/i)
  })

  it('removes a stored key', async () => {
    const w = mount(ProviderKeysCard)
    await flushPromises()
    await w.get('[data-testid="remove-anthropic"]').trigger('click')
    await flushPromises()
    expect(api.deleteProviderCredential).toHaveBeenCalledWith('anthropic')
  })
})
