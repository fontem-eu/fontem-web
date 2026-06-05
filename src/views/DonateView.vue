<script setup>
import { ref, onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Support Fontem' })

// Canonical Open Collective slug. The Collective + fiscal host
// setup happens out-of-band; if the URL changes, update this
// constant. Tier URLs follow the OC `/contribute/{tier-slug}`
// convention — OC normalises the slug so these stay stable even
// if the tier display name changes.
const OC_URL = 'https://opencollective.com/fontem'
const TIERS = [
  {
    name: 'Supporter',
    amount: '€5 / month',
    url: `${OC_URL}/contribute/supporter/checkout`,
    desc: 'Keeps the lights on — hosting, domain, data-source licences.',
  },
  {
    name: 'Backer',
    amount: '€25 / month',
    url: `${OC_URL}/contribute/backer/checkout`,
    desc: 'Funds ongoing data-pipeline work: new sources, better coverage.',
  },
  {
    name: 'Partner',
    amount: '€100 / month',
    url: `${OC_URL}/contribute/partner/checkout`,
    desc: 'Supports a seat on the core team and long-term data stewardship.',
  },
  {
    name: 'One-off',
    amount: 'Any amount',
    url: `${OC_URL}/donate`,
    desc: 'A single contribution, whatever fits. No commitment.',
  },
]

const backers = ref([])
const backersError = ref(false)
onMounted(async () => {
  // Fetch the public OC members list. Graceful degradation: on any
  // failure we just render no backers block — never a scary error.
  try {
    const r = await fetch(`${OC_URL}/members/all.json`)
    if (!r.ok) throw new Error('no members')
    const members = await r.json()
    backers.value = members
      .filter((m) => m.role === 'BACKER' && m.name)
      .slice(0, 48)
  } catch {
    backersError.value = true
  }
})
</script>

<template>
  <div class="donate">
    <header class="donate-hdr">
      <div>
        <h1>{{ $t('donate.support_fontem') }}</h1>
        <p class="donate-sub">
          Fontem is free to use and always will be. Donations keep the
          data pipelines running, the graph growing, and the team able to
          spend real time on quality. If the platform has been useful to
          you or your work, this is how you can help it last.
        </p>
      </div>
      <ThemeToggle />
    </header>

    <section class="donate-tiers">
      <a
        v-for="t in TIERS"
        :key="t.name"
        class="donate-tier"
        :href="t.url"
        target="_blank"
        rel="noopener noreferrer"
        :data-testid="`donate-tier-${t.name.toLowerCase()}`"
      >
        <div class="donate-tier-name">{{ t.name }}</div>
        <div class="donate-tier-amount">{{ t.amount }}</div>
        <p class="donate-tier-desc">{{ t.desc }}</p>
        <span class="donate-tier-cta">{{ $t('donate.contribute_rarr') }}</span>
      </a>
    </section>

    <section class="donate-transparency">
      <h2>{{ $t('donate.where_the_money_goes') }}</h2>
      <p>{{ $t('donate.donations_flow_through_a_fiscal_host_non') }}<a :href="OC_URL" target="_blank" rel="noopener noreferrer">{{ $t('donate.open_collective') }}</a>.
        Every contribution and every expense is public on the ledger —
        the same transparency standard the platform asks of the
        institutions it covers.
      </p>
      <p class="donate-fineprint">
        Fontem itself does not hold donor funds directly. The fiscal
        host is the legal recipient and handles tax and compliance.
      </p>
    </section>

    <section v-if="backers.length" class="donate-backers">
      <h2>{{ $t('donate.backers') }}</h2>
      <p class="donate-backers-intro">{{ $t('donate.thanks_to_everyone_keeping_fontem_alive') }}</p>
      <ul class="donate-backers-list">
        <li v-for="b in backers" :key="b.MemberId">
          <a
            v-if="b.profile"
            :href="b.profile"
            target="_blank"
            rel="noopener noreferrer"
          >{{ b.name }}</a>
          <span v-else>{{ b.name }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.donate {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1rem 4rem;
}
.donate-hdr {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2rem 0 1.25rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.75rem;
  gap: 1rem;
}
.donate-hdr h1 {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}
.donate-sub {
  font-size: 0.95rem;
  color: var(--muted);
  max-width: 640px;
  line-height: 1.5;
  margin: 0;
}

.donate-tiers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 2.5rem;
}
.donate-tier {
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}
.donate-tier:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.donate-tier-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.donate-tier-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
  margin: 0.35rem 0 0.5rem;
}
.donate-tier-desc {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0 0 0.85rem;
  line-height: 1.45;
  flex: 1;
}
.donate-tier-cta {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
}

.donate-transparency {
  margin-bottom: 2.5rem;
}
.donate-transparency h2,
.donate-backers h2 {
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0 0 0.6rem;
}
.donate-transparency p {
  font-size: 0.92rem;
  color: var(--text);
  line-height: 1.55;
  margin: 0 0 0.6rem;
}
.donate-transparency a {
  color: var(--accent);
}
.donate-fineprint {
  font-size: 0.82rem !important;
  color: var(--muted) !important;
}

.donate-backers-intro {
  font-size: 0.88rem;
  color: var(--muted);
  margin: 0 0 0.75rem;
}
.donate-backers-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.donate-backers-list li {
  font-size: 0.85rem;
}
.donate-backers-list a {
  color: var(--accent);
  text-decoration: none;
}
.donate-backers-list a:hover {
  text-decoration: underline;
}
</style>
