/* Motion landing (docs/23 §4–§7). GSAP + ScrollTrigger + SplitText + Lenis HANYA dimuat dinamis dari sini,
   sehingga tidak masuk bundel awal dan halaman statis sudah terbaca sebelum pustaka gerak selesai diunduh.
   Mode:
   - cinematic : desktop >= 768 px dan tanpa prefers-reduced-motion → hero ter-pin + scrub + smooth scroll.
   - light     : HP dan gerak diizinkan → hanya reveal saat masuk viewport.
   - (tidak ada): prefers-reduced-motion: reduce → tidak mengimpor apa pun. */

export const Q_CINEMATIC = '(min-width: 768px) and (prefers-reduced-motion: no-preference)'
const Q_MOTION_OK = '(prefers-reduced-motion: no-preference)'

export const hasMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export const isCinematic = (): boolean => hasMatchMedia() && window.matchMedia(Q_CINEMATIC).matches
const motionAllowed = (): boolean => hasMatchMedia() && window.matchMedia(Q_MOTION_OK).matches

export interface MotionHandle {
  destroy: () => void
  scrollTo: (target: string | number | HTMLElement) => void
}

// Geometri bukaan portal pada viewBox bingkai 600x900 (lihat gen_landing.py portal_frame).
const OPEN = { l: 0.1167, r: 0.1167, t: 0.0778, b: 0.0667 }
const DETAIL_STEPS = 5

export async function buildCinematic(root: HTMLElement): Promise<MotionHandle> {
  const [{ gsap }, { ScrollTrigger }, { SplitText }, { default: Lenis }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('gsap/SplitText'),
    import('lenis'),
  ])
  gsap.registerPlugin(ScrollTrigger, SplitText)

  const q = <T extends HTMLElement = HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel)
    if (!el) throw new Error(`[landing] elemen ${sel} tidak ditemukan`)
    return el
  }
  const qa = (sel: string): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(sel))

  // ---- smooth scroll (Lenis) disambung ke ScrollTrigger ----
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  const tick = (time: number) => lenis.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  const nav = q('[data-m=nav]')
  const hero = q('[data-m=hero]')
  const stage = q('[data-m=stage]')
  const clip = q('[data-m=clip]')
  const plateBg = q('[data-m=plate-bg]')
  const plateFg = q('[data-m=plate-fg]')
  const glow = q('[data-m=glow]')
  const frame = q('[data-m=frame]')
  const portal = q('[data-m=portal]')

  // ---- geometri portal → klip adegan layar penuh (sinkron dengan skala bingkai) ----
  const geo = { cx: 0, cy: 0, pw: 1, ph: 1, vw: 1, vh: 1, sEnd: 1 }
  const measure = () => {
    const rs = stage.getBoundingClientRect()
    const rp = portal.getBoundingClientRect()
    geo.vw = stage.clientWidth
    geo.vh = stage.clientHeight
    geo.pw = portal.offsetWidth
    geo.ph = portal.offsetHeight
    geo.cx = rp.left - rs.left + rp.width / 2
    geo.cy = rp.top - rs.top + rp.height / 2
    const halfW = geo.pw * (0.5 - OPEN.l)
    const need = [
      geo.cx / halfW,
      (geo.vw - geo.cx) / halfW,
      geo.cy / (geo.ph * (0.5 - OPEN.t)),
      (geo.vh - geo.cy) / (geo.ph * (0.5 - OPEN.b)),
    ]
    geo.sEnd = Math.max(...need) * 1.05
  }
  const proxy = { s: 1 }
  const render = () => {
    const s = proxy.s
    frame.style.transform = `scale(${s})`
    const halfW = geo.pw * (0.5 - OPEN.l) * s
    const left = geo.cx - halfW
    const right = geo.cx + halfW
    const top = geo.cy - geo.ph * (0.5 - OPEN.t) * s
    const bottom = geo.cy + geo.ph * (0.5 - OPEN.b) * s
    const t = Math.max(0, top)
    const r = Math.max(0, geo.vw - right)
    const b = Math.max(0, geo.vh - bottom)
    const l = Math.max(0, left)
    const rad = Math.max(0, (right - left) / 2)
    clip.style.clipPath = `inset(${t}px ${r}px ${b}px ${l}px round ${rad}px ${rad}px 0 0)`
  }
  measure()
  render()
  ScrollTrigger.addEventListener('refreshInit', measure)

  // ---- parallax pointer: lapisan dekat bergeser lebih jauh dari lapisan jauh (hanya pointer halus/mouse) ----
  const finePointer = window.matchMedia('(pointer: fine)').matches
  let onMove: ((e: PointerEvent) => void) | null = null
  if (finePointer) {
    const qt = (el: HTMLElement, prop: 'x' | 'y') =>
      gsap.quickTo(el, prop, { duration: 1, ease: 'power3' })
    const bgX = qt(plateBg, 'x')
    const bgY = qt(plateBg, 'y')
    const fgX = qt(plateFg, 'x')
    const fgY = qt(plateFg, 'y')
    onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      bgX(-nx * 16)
      bgY(-ny * 9)
      fgX(nx * 54)
      fgY(ny * 26)
    }
    hero.addEventListener('pointermove', onMove)
  }

  // ---- nada navigasi (gelap di atas hero/kota, terang di atas krem) ----
  // Nada nav: 'light' = latar terang → teks gelap. Deterministik dari geometri (bukan hit-test, karena overlay
  // pointer-events:none tak terlihat oleh elementsFromPoint): blok krem yang memegang titik tengah nav, atau
  // overlay krem hero yang sudah dominan selama hero masih terlihat.
  const heroCream = q('[data-m=cream]')
  const creamBlock = q('[data-m=creamwrap]')
  const sampleTone = () => {
    const probe = 36
    const cr = creamBlock.getBoundingClientRect()
    const inCream = cr.top <= probe && cr.bottom > probe
    const heroOn =
      hero.getBoundingClientRect().bottom > probe &&
      Number(getComputedStyle(heroCream).opacity) > 0.5
    const tone = inCream || heroOn ? 'light' : 'dark'
    if (nav.dataset.tone !== tone) nav.dataset.tone = tone
  }

  const splits: InstanceType<typeof SplitText>[] = []
  // aria 'none' untuk <p>/<span>: SplitText otomatis menambah aria-label, yang DILARANG pada elemen tanpa role (axe aria-prohibited-attr).
  const split = (
    el: HTMLElement,
    type: string,
    mask?: 'chars' | 'lines' | 'words',
    aria: 'auto' | 'none' = 'auto',
  ) => {
    const s = new SplitText(el, { type, aria, ...(mask ? { mask } : {}) })
    splits.push(s)
    // Topeng (overflow clip) memotong ascender/descender Cormorant karena line-height ketat (1,02).
    // Padding+margin negatif memperluas kotak klip 0,2em ke atas/bawah TANPA menggeser tata letak.
    if (mask) {
      const items = mask === 'chars' ? s.chars : mask === 'lines' ? s.lines : s.words
      items.forEach((it) => {
        const m = (it as HTMLElement).parentElement
        if (m && m !== el) {
          m.style.paddingBlock = '0.2em'
          m.style.marginBlock = '-0.2em'
        }
      })
    }
    return s
  }

  const ctx = gsap.context(() => {
    // ============ progress bar tipis ============
    gsap.fromTo(
      q('[data-m=progress]'),
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.3,
        },
      },
    )

    // ============ HERO ter-pin: portal membesar → masuk ke panggung ============
    const t1 = split(q('[data-m=t1]'), 'chars')
    const t2 = split(q('[data-m=t2]'), 'chars', undefined, 'none')
    const manifestoWords = qa('[data-m=manifesto] .w')
    const cols = qa('[data-m=col]')
    const dust = qa('[data-m=dust]')

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=4200',
        scrub: 0.6,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    })

    // kamera mendorong masuk: skala + sedikit miring + naik, lalu menetap
    // PARALLAX KEDALAMAN: latar bersih (jauh) dan siluet penonton (dekat) bergerak dengan laju berbeda.
    // Siluet "menerjang" ke arah kamera saat portal membuka (skala 1.65 → 1), lalu terus hanyut pelan selama
    // manifesto dibaca sehingga adegan tidak pernah diam. Latar hanya bergerak sedikit.
    // v4 — angka dari docs/references/aerive-trace.md (1 unit timeline ≈ 328 px scroll):
    // jendela membesar eksponensial mulai ≈300 px sampai ≈1400 px (power2.in), latar zoom linear 1→1.15
    // sepanjang 0–1600 px, tanpa miring. Siluet depan tetap menerjang kamera (lapis kedekatan).
    gsap.set(plateFg, { scale: 1.7, yPercent: 16 })
    gsap.set(glow, { opacity: 0.15 })
    tl.to(proxy, { s: () => geo.sEnd, ease: 'power2.in', duration: 3.4, onUpdate: render }, 0.9)
      .to(plateBg, { scale: 1.15, duration: 4.9, ease: 'none' }, 0)
      .to(plateFg, { scale: 1, yPercent: 0, duration: 4.2, ease: 'power3.out' }, 0)
      .to(glow, { opacity: 1, duration: 3.5 }, 0.6)
      .to(plateFg, { scale: 1.1, yPercent: 7, duration: 7, ease: 'none' }, 4.4)
      // geser lateral berlawanan arah antar-lapis (Aerive: langit hanyut linear ≈ -0,12 px per px scroll)
      .fromTo(plateBg, { xPercent: 0 }, { xPercent: -2.5, duration: 12.8, ease: 'none' }, 0)
      .fromTo(plateFg, { xPercent: 0 }, { xPercent: 2, duration: 12.8, ease: 'none' }, 0)

      // huruf judul tersebar keluar saat portal membuka (bukan sekadar fade)
      .fromTo(
        t1.chars,
        { opacity: 1, x: 0, y: 0, rotate: 0 },
        {
          opacity: 0,
          x: () => gsap.utils.random(-36, -6),
          y: () => gsap.utils.random(-70, 70),
          rotate: () => gsap.utils.random(-14, 14),
          duration: 2.2,
          ease: 'power2.in',
          stagger: { each: 0.03, from: 'end' },
        },
        0.5,
      )
      .fromTo(
        t2.chars,
        { opacity: 1, x: 0, y: 0, rotate: 0 },
        {
          opacity: 0,
          x: () => gsap.utils.random(6, 36),
          y: () => gsap.utils.random(-70, 70),
          rotate: () => gsap.utils.random(-14, 14),
          duration: 2.2,
          ease: 'power2.in',
          stagger: { each: 0.03, from: 'start' },
        },
        0.6,
      )
      .fromTo(
        [q('[data-m=sub]'), q('[data-m=hint]')],
        { opacity: 1, y: 0 },
        { opacity: 0, y: 24, duration: 1.2 },
        0.4,
      )
      .fromTo(frame, { opacity: 1 }, { opacity: 0, duration: 1.0 }, 3.6)
    // debu/bokeh: tiap butir bergerak dengan kecepatan berbeda = kedalaman
    dust.forEach((d) => {
      const depth = Number(d.dataset.d ?? 1)
      tl.fromTo(d, { y: 80 * depth }, { y: -520 * depth, duration: 12, ease: 'none' }, 0)
    })

    tl.to(q('[data-m=veil]'), { opacity: 0.3, duration: 1.4 }, 3.2)
      .to(q('[data-m=navmark]'), { opacity: 1, duration: 0.8 }, 3.6)
      .fromTo(
        q('[data-m=mark]'),
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 1.1 },
        2.7,
      )
      .to(q('[data-m=mark]'), { opacity: 0, scale: 1.12, duration: 1 }, 4.1)
      .fromTo(
        manifestoWords,
        { opacity: 0.12, y: 12 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.07 },
        4.2,
      )
      .to(q('[data-m=manifesto]'), { opacity: 0, y: -40, duration: 0.9 }, 7.2)
      .to(q('[data-m=veil]'), { opacity: 0.42, duration: 1 }, 6.4)
      .fromTo(q('[data-m=lockup]'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9 }, 7.9)
      .fromTo(
        cols.slice(0, 2),
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.9, stagger: 0.25 },
        8.1,
      )
      .fromTo(
        cols.slice(2),
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.9, stagger: 0.25 },
        9.1,
      )
      .to([q('[data-m=lockup]'), ...cols], { opacity: 0, y: -40, duration: 0.9 }, 10.7)
      .fromTo(
        q('[data-m=haze]'),
        { yPercent: 100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.8 },
        10.3,
      )
      .to(q('[data-m=cream]'), { opacity: 1, duration: 1.1 }, 11.7)

    // ============ INTRO otomatis: parallax berjalan sendiri dulu, BARU scroll aktif ============
    // Hanya memakai properti yang tidak disentuh timeline scrub (filter, yPercent, autoAlpha pada pembungkus),
    // supaya keduanya tidak berebut. Scroll dikunci (Lenis.stop) sampai selesai; kunci pengaman 4,5 dtk.
    const introTargets = [clip, portal, q('[data-m=t1]'), q('[data-m=t2]')]
    if (window.scrollY < 40) {
      lenis.stop()
      gsap.set(introTargets, { autoAlpha: 0 })
      gsap.set(plateBg, { filter: 'blur(18px) brightness(0.55)' })
      gsap.set(plateFg, { filter: 'blur(26px) brightness(0.5)' })
      gsap.set([...t1.chars, ...t2.chars], { yPercent: 70, filter: 'blur(14px)' })
      gsap.set(nav, { autoAlpha: 0, y: -14 })
      root.dataset.intro = 'run'
      const release = () => {
        if (root.dataset.intro === 'done') return
        root.dataset.intro = 'done'
        lenis.start()
      }
      const safety = window.setTimeout(release, 4500)
      const fontsReady = document.fonts?.ready ?? Promise.resolve()
      void fontsReady.then(() => {
        gsap
          .timeline({
            defaults: { ease: 'power3.out' },
            onComplete: () => {
              window.clearTimeout(safety)
              release()
            },
          })
          // adegan menyala: lapis jauh lebih dulu fokus, lapis dekat menyusul (rack focus = rasa kedalaman)
          .to([clip, portal], { autoAlpha: 1, duration: 1.1 }, 0)
          .to(plateBg, { filter: 'blur(0px) brightness(1)', duration: 1.8 }, 0)
          .to(plateFg, { filter: 'blur(0px) brightness(1)', duration: 1.8 }, 0.35)
          // kamera "mendarat": lapisan bergerak berbeda arah selama intro
          .fromTo(plateBg, { scale: 1.12 }, { scale: 1, duration: 2.4, ease: 'power2.out' }, 0)
          .fromTo(plateFg, { scale: 2.05 }, { scale: 1.7, duration: 2.2, ease: 'power3.out' }, 0)
          .to([q('[data-m=t1]'), q('[data-m=t2]')], { autoAlpha: 1, duration: 0.2 }, 0.5)
          .to(
            t1.chars,
            { yPercent: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.045, ease: 'power4.out' },
            0.55,
          )
          .to(
            t2.chars,
            { yPercent: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.04, ease: 'power4.out' },
            0.95,
          )
          .to(nav, { autoAlpha: 1, y: 0, duration: 0.9 }, 1.4)
      })
    } else {
      root.dataset.intro = 'done'
    }

    // ============ FLAGSHIP (krem): huruf naik dari topeng, karcis berputar 3D ============
    const flag = q('[data-m=flagship]')
    const fa = split(q('[data-m=fa]'), 'chars', 'chars', 'none')
    const fb = split(q('[data-m=fb]'), 'chars', 'chars', 'none')
    const flagTrigger = { trigger: flag, start: 'top 70%', toggleActions: 'play none none reverse' }
    gsap.from(fa.chars, {
      yPercent: 115,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.05,
      scrollTrigger: flagTrigger,
    })
    gsap.from(fb.chars, {
      yPercent: 115,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.05,
      delay: 0.25,
      scrollTrigger: flagTrigger,
    })
    gsap.fromTo(
      q('[data-m=ft]'),
      {
        rotateX: 58,
        rotateY: -34,
        rotate: -30,
        y: 180,
        scale: 0.72,
        opacity: 0,
        transformPerspective: 1100,
      },
      {
        rotateX: 8,
        rotateY: 5,
        rotate: -12,
        y: 0,
        scale: 1,
        opacity: 1,
        ease: 'power2.out',
        transformPerspective: 1100,
        scrollTrigger: { trigger: flag, start: 'top 80%', end: 'center 45%', scrub: 1 },
      },
    )
    // melayang halus setelah masuk
    gsap.to(q('[data-m=ft] svg'), {
      y: -10,
      duration: 3.2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })

    // ============ SPESIFIKASI: denah tersapu dari atas, teks naik ============
    const specs = q('[data-m=specs]')
    gsap.fromTo(
      q('[data-m=plan]'),
      { clipPath: 'inset(0 0 100% 0)', opacity: 0.2 },
      {
        clipPath: 'inset(0 0 0% 0)',
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: specs, start: 'top 70%', end: 'top 15%', scrub: 0.8 },
      },
    )
    gsap.from(qa('[data-m=specs-text]'), {
      y: 48,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.18,
      scrollTrigger: { trigger: specs, start: 'top 68%', toggleActions: 'play none none reverse' },
    })

    // ============ DETAIL: ter-pin, scroll memajukan akordeon + foto ============
    const details = q('[data-m=details]')
    const title = split(q('#details-title'), 'lines', 'lines')
    gsap.from(title.lines, {
      yPercent: 105,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: details,
        start: 'top 75%',
        toggleActions: 'play none none reverse',
      },
    })
    let lastStep = -1
    ScrollTrigger.create({
      trigger: details,
      start: 'top top',
      end: '+=2600',
      pin: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        const i = Math.min(DETAIL_STEPS - 1, Math.floor(self.progress * DETAIL_STEPS))
        // hanyut kedalaman di dalam langkah: --p 0..1 (foto depan/belakang bergerak berbeda)
        details.style.setProperty('--p', (self.progress * DETAIL_STEPS - i).toFixed(3))
        if (i !== lastStep) {
          lastStep = i
          details.dispatchEvent(new CustomEvent('landing-step', { detail: i }))
        }
      },
    })

    // ============ KOTA: kata besar, bola disko paralaks, kota bergantian, karcis geser masuk ============
    const cities = q('[data-m=cities]')
    gsap.fromTo(
      q('[data-m=cword]'),
      { yPercent: -14, opacity: 0.15 },
      {
        yPercent: 0,
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: cities, start: 'top 88%', end: 'top 20%', scrub: true },
      },
    )
    gsap.fromTo(
      q('[data-m=ball]'),
      { scale: 0.82, rotate: -8, yPercent: 10 },
      {
        scale: 1.08,
        rotate: 6,
        yPercent: -8,
        ease: 'none',
        scrollTrigger: { trigger: cities, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    )
    const swaps = qa('[data-m=swap] > span')
    if (swaps.length > 1) {
      const sw = gsap.timeline({
        scrollTrigger: { trigger: cities, start: 'top 55%', end: 'bottom 55%', scrub: true },
      })
      swaps.forEach((el, i) => {
        if (i === 0) return
        sw.to(
          swaps[i - 1] as HTMLElement,
          { opacity: 0, yPercent: -60, duration: 1 },
          i * 2,
        ).fromTo(el, { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0, duration: 1 }, i * 2)
      })
    }
    gsap.fromTo(
      q('[data-m=card]'),
      { xPercent: 45, rotate: 12, opacity: 0 },
      {
        xPercent: 0,
        rotate: 0,
        opacity: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: q('[data-m=card]'),
          start: 'top 92%',
          end: 'top 52%',
          scrub: 0.8,
        },
      },
    )

    // ============ CTA ============
    const cta = split(q('#cta-title'), 'lines', 'lines')
    const ctaTrigger = {
      trigger: q('[data-m=cta]'),
      start: 'top 70%',
      toggleActions: 'play none none reverse',
    }
    gsap.from(cta.lines, {
      yPercent: 105,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.14,
      scrollTrigger: ctaTrigger,
    })
    gsap.from(qa('[data-m=cta-in]:not(h2)'), {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.16,
      delay: 0.3,
      scrollTrigger: ctaTrigger,
    })

    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: sampleTone, onRefresh: sampleTone })
    sampleTone()
  }, root)

  const scrollTo = (target: string | number | HTMLElement) =>
    lenis.scrollTo(target, { offset: 0, duration: 1.4 })

  return {
    scrollTo,
    destroy: () => {
      ScrollTrigger.removeEventListener('refreshInit', measure)
      if (onMove) hero.removeEventListener('pointermove', onMove)
      ctx.revert()
      splits.forEach((s) => s.revert())
      gsap.ticker.remove(tick)
      lenis.destroy()
      frame.style.transform = ''
      clip.style.clipPath = ''
      delete nav.dataset.tone
      delete root.dataset.intro
      lenis.start()
    },
  }
}

/** HP / gerak diizinkan: reveal ringan saat masuk viewport, tanpa pin dan tanpa smooth-scroll. */
export async function buildLight(root: HTMLElement): Promise<MotionHandle> {
  const fallback = (target: string | number | HTMLElement) => {
    const behavior = motionAllowed() ? 'smooth' : 'auto'
    if (typeof target === 'number') return window.scrollTo({ top: target, behavior })
    const el = typeof target === 'string' ? root.querySelector(target) : target
    el?.scrollIntoView({ behavior })
  }
  if (!motionAllowed()) return { destroy: () => undefined, scrollTo: fallback }

  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ])
  gsap.registerPlugin(ScrollTrigger)
  const ctx = gsap.context(() => {
    gsap.utils.toArray<HTMLElement>('[data-reveal]', root).forEach((el) => {
      gsap.from(el, {
        y: 28,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      })
    })
  }, root)
  return { scrollTo: fallback, destroy: () => ctx.revert() }
}
