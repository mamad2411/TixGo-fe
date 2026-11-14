<script setup lang="ts">
import { MapPin, ShieldCheck, Ticket } from '@vicons/tabler'
import { NIcon } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { listEvents } from '@/api/events'
import { useCookieConsent } from '@/composables/useCookieConsent'
import { genreIcon } from '@/utils/icons'

const { t } = useI18n()
const { reopen: reopenCookie } = useCookieConsent()
const year = new Date().getFullYear()

// Tautan jelajah dibangun dari katalog nyata (kota & genre yang memang punya konser) — tidak ada tautan mati.
const cities = ref<string[]>([])
const genres = ref<string[]>([])
onMounted(async () => {
  try {
    const list = (await listEvents({ per_page: 50 })).data
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort()
    cities.value = uniq(list.map((e) => e.city))
    genres.value = uniq(list.map((e) => e.genre))
  } catch {
    /* footer tetap tampil tanpa daftar jelajah; galat katalog ditampilkan oleh halamannya */
  }
})
const LEGAL = ['terms', 'privacy', 'refund', 'how_to_buy', 'faq', 'contact'] as const
</script>

<template>
  <footer class="ft tone-light">
    <div class="ft__in">
      <div class="ft__brand">
        <p class="ft__mark">TIXGO</p>
        <p class="a-serif ft__tag">{{ t('footer.tagline') }}</p>
        <ul class="ft__trust">
          <li>
            <NIcon :component="Ticket" :size="18" aria-hidden="true" /> {{ t('footer.trust.fair') }}
          </li>
          <li>
            <NIcon :component="ShieldCheck" :size="18" aria-hidden="true" />
            {{ t('footer.trust.price') }}
          </li>
        </ul>
      </div>

      <nav v-if="cities.length" class="ft__col" :aria-label="t('footer.byCity')">
        <h2 class="a-caps">
          <NIcon :component="MapPin" :size="15" aria-hidden="true" /> {{ t('footer.byCity') }}
        </h2>
        <RouterLink v-for="c in cities" :key="c" :to="{ name: 'events', query: { city: c } }">{{
          c
        }}</RouterLink>
      </nav>

      <nav v-if="genres.length" class="ft__col" :aria-label="t('footer.byGenre')">
        <h2 class="a-caps">{{ t('footer.byGenre') }}</h2>
        <RouterLink v-for="g in genres" :key="g" :to="{ name: 'events', query: { genre: g } }">
          <NIcon :component="genreIcon(g)" :size="15" aria-hidden="true" /> {{ g }}
        </RouterLink>
      </nav>
    </div>

    <nav class="ft__legal" :aria-label="t('legal.nav')">
      <RouterLink v-for="k in LEGAL" :key="k" :to="{ name: 'legal', params: { kind: k } }">{{
        t(`legal.k.${k}`)
      }}</RouterLink>
      <button type="button" class="ft__ck" data-test="cookie-settings" @click="reopenCookie">
        {{ t('ck.settings') }}
      </button>
    </nav>

    <div class="ft__base">
      <p class="a-muted">{{ t('footer.copy', { year }) }}</p>
    </div>
  </footer>
</template>

<style scoped>
.ft__legal {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding: 0 var(--a-pad) 12px;
  max-width: 1280px;
  margin: 0 auto;
}
.ft__legal a {
  color: var(--a-muted);
  font-size: 14px;
  text-decoration: none;
  min-height: 24px;
}
.ft__ck {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
}
.ft__legal a:hover {
  color: var(--a-gold);
  text-decoration: underline;
}
.ft {
  margin-top: 0;
  border-top: 0;
  background: var(--a-bg);
}
/* Jarak isi halaman ke footer. Dulu ini padding pada <main>, tetapi <main> transparan sehingga
   yang tampak warna dasar .app (#0f0e0c) — hitam di mode terang maupun gelap. Di sini jaraknya
   ikut token .tone-light, jadi menyambung warna halaman pada kedua mode. Garis pemisah diletakkan
   di ujung jarak, bukan menempel isi halaman. */
.ft::before {
  content: '';
  display: block;
  height: clamp(56px, 7vh, 88px);
  border-bottom: 1px solid var(--a-line);
}
.ft__in {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 40px;
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 56px var(--a-pad) 32px;
}
.ft__mark {
  font-family: var(--a-serif);
  font-size: 30px;
  letter-spacing: 0.24em;
  color: var(--a-cream);
}
.ft__tag {
  margin-top: 10px;
  max-width: 24ch;
  font-size: 26px;
  line-height: 1.15;
  color: var(--a-ink);
}
.ft__trust {
  display: grid;
  gap: 8px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
  color: var(--a-gold);
  font-size: 14px;
}
.ft__trust li {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ft__col {
  display: grid;
  align-content: start;
  gap: 2px;
}
.ft__col h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
}
.ft__col a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--a-ink);
  text-decoration: none;
  font-size: 15px;
}
.ft__col a:hover {
  color: var(--a-gold);
}
.ft__base {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 24px;
  max-width: var(--a-max);
  margin: 0 auto;
  padding: 18px var(--a-pad) 28px;
  border-top: 1px solid var(--a-line);
  font-size: 13px;
}
@media (max-width: 760px) {
  .ft__in {
    grid-template-columns: 1fr 1fr;
  }
  .ft__brand {
    grid-column: 1 / -1;
  }
}
</style>
