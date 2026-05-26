// === sections.jsx ===
// Sections 2–7 (post-hero). Structure mirrors the lightweight.info homepage
// (video → instagram grid → full-bleed statement → newsletter → outro
// wordmark → 6-col footer), but every byte of copy, imagery and chrome is
// Elyxie's. CornerCrosses is rendered inside every section except the footer
// (where only the top pair appears).

const { useState: useS, useEffect: useE, useRef: useR } = React;

// ── CornerCrosses ─────────────────────────────────────────────────────────
// Four tiny "+" decorations at section corners. `topOnly` for the footer.
function CornerCrosses({ topOnly = false }) {
  return (
    <div className="cc" aria-hidden>
      <span className="cc__cross cc__cross--tl"></span>
      <span className="cc__cross cc__cross--tr"></span>
      {!topOnly && <span className="cc__cross cc__cross--bl"></span>}
      {!topOnly && <span className="cc__cross cc__cross--br"></span>}
    </div>
  );
}

// ── Container ────────────────────────────────────────────────────────────
function Container({ children, className = '' }) {
  return <div className={`Container ${className}`}>{children}</div>;
}

// ===========================================================
//  Section 2 — Video full-width + Play (opens lightbox)
// ===========================================================
function SectionVideoHero({ lang }) {
  const [open, setOpen] = useS(false);

  // Esc closes lightbox
  useE(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const t = lang === 'es' ? {
    play: 'REPRODUCIR',
    eyebrow: 'CINEMATOGRAFÍA · LAGUNA NEGRA',
    caption: 'El filme. Tres minutos en la cordillera, antes de bajar el agua.',
    lbTitle: 'EL DESCENSO DEL AGUA',
    lbSub: 'Cordillera Huancabamba · 3.957 m s.n.m. · 2026',
    soon: 'Vídeo próximamente · Reservado para custodios',
  } : {
    play: 'PLAY',
    eyebrow: 'CINEMATOGRAPHY · BLACK LAGOON',
    caption: 'The film. Three minutes in the cordillera, before the water descends.',
    lbTitle: 'THE WATER\'S DESCENT',
    lbSub: 'Huancabamba Cordillera · 3,957 m a.s.l. · 2026',
    soon: 'Film coming soon · Reserved for custodians',
  };

  return (
    <section className="Section theme-light" data-theme="light" data-section="hero-video" data-screen-label="02 Video">
      <Container>
        <div className="VideoSection__eyebrow">
          <span className="VideoSection__line"></span>
          {t.eyebrow}
        </div>

        <figure className="MediaPlayer">
          {/* Poster-only; no MP4 source. Behaves as still until the user opens
              the lightbox. Modern browsers (97%+) accept WebP as a poster, so
              swap to that for a ~30× weight reduction (4.2 MB → 130 KB). */}
          <video
            className="MediaPlayer__video"
            playsInline muted loop
            preload="metadata"
            poster="assets/photography/video-poster-1440.webp"
          ></video>

          <button className="PlayButton" onClick={() => setOpen(true)} aria-label={t.play}>
            <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden>
              <path d="M0 0L14 8L0 16V0Z" fill="currentColor"/>
            </svg>
            <span className="PlayButton__label">{t.play}</span>
          </button>

          <CornerCrosses />
        </figure>

        <figcaption className="MediaPlayer__caption">{t.caption}</figcaption>
      </Container>

      {open && (
        <div className="Lightbox" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <button className="Lightbox__close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          <div className="Lightbox__inner">
            <picture>
              <source type="image/webp" srcSet="assets/photography/video-poster.webp"/>
              <img src="assets/photography/video-poster.jpg" alt="" decoding="async"/>
            </picture>
            <div className="Lightbox__overlay">
              <div className="Lightbox__title">{t.lbTitle}</div>
              <div className="Lightbox__sub">{t.lbSub}</div>
              <div className="Lightbox__soon">{t.soon}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ===========================================================
//  Section 3 — #elyxie Instagram grid (3 cards, mixed ratios)
// ===========================================================
const INSTA = [
  {
    img: 'assets/photography/insta-01.jpg',
    ratio: '0.78 / 1',           // ~4:5 portrait
    url:  'https://instagram.com/elyxie.world',
    es: 'Custodia primera. La esfera viaja en el bolsillo interior de un abrigo de paño desde Lima. Llega antes que su dueño.',
    en: 'First custody. The sphere travels in the inner pocket of a wool coat from Lima. It arrives before its owner.',
    handle: '@maria.elena',
  },
  {
    img: 'assets/photography/insta-02.jpg',
    ratio: '1 / 1',              // square
    url:  'https://instagram.com/elyxie.world',
    es: 'A las 03:14 todavía brilla. La habitación a oscuras, el agua despierta. Es la única que no duerme.',
    en: 'At 03:14 it still glows. The room in darkness, the water awake. The only thing that does not sleep.',
    handle: '@tomas.huaringa',
  },
  {
    img: 'assets/photography/insta-03.jpg',
    ratio: '0.78 / 1',
    url:  'https://instagram.com/elyxie.world',
    es: 'La caja de cedro grabada. Hexágono, agua, sello. No es embalaje — es la primera capa de la custodia.',
    en: 'The engraved cedar box. Hexagon, water, seal. It is not packaging — it is the first layer of custody.',
    handle: '@elyxie.world',
  },
];

function SectionInstagramGrid({ lang }) {
  return (
    <section className="Section theme-light" data-theme="light" data-section="elyxie-feed" data-screen-label="03 Instagram">
      <Container>
        <div className="SectionHead">
          <h2 className="SectionHead__title">#elyxie</h2>
          <div className="SectionHead__meta">
            <span>{lang === 'es' ? 'CUSTODIOS · DICIEMBRE 2026' : 'CUSTODIANS · DECEMBER 2026'}</span>
            <a className="SectionHead__link" href="https://instagram.com/elyxie.world" target="_blank" rel="noopener">
              {lang === 'es' ? 'VER MÁS' : 'VIEW MORE'} →
            </a>
          </div>
        </div>

        <ul className="InstaGrid">
          {INSTA.map((p, i) => {
            const webp = p.img.replace(/\.jpg$/, '.webp');
            const webp480 = p.img.replace(/\.jpg$/, '-480.webp');
            return (
            <li key={i} className="InstaCard">
              <a href={p.url} target="_blank" rel="noopener" aria-label={`Instagram post ${i + 1}`}>
                <figure className="InstaCard__media" style={{ aspectRatio: p.ratio }}>
                  <picture>
                    <source
                      type="image/webp"
                      srcSet={`${webp480} 480w, ${webp} 720w`}
                      sizes="(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <img src={p.img} alt="" loading="lazy" decoding="async"/>
                  </picture>
                  <span className="InstaCard__badge" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="5"/>
                      <circle cx="12" cy="12" r="4"/>
                      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/>
                    </svg>
                  </span>
                </figure>
                <figcaption className="InstaCard__caption">
                  <span className="InstaCard__handle">{p.handle}</span>
                  <span className="InstaCard__text">{p[lang]}</span>
                </figcaption>
              </a>
            </li>
            );
          })}
        </ul>

        <CornerCrosses />
      </Container>
    </section>
  );
}

// ===========================================================
//  Section 4 — Full-bleed media + headline
// ===========================================================
function SectionBrandStatement({ lang }) {
  const t = lang === 'es' ? {
    wordmark: 'elyxie',
    head: <>En Elyxie no fabricamos joyas.<br/>Custodiamos <em>agua sagrada</em>,<br/>tallada en plata y oro.</>,
    btn: 'Sobre nosotros',
  } : {
    wordmark: 'elyxie',
    head: <>At Elyxie we do not make jewelry.<br/>We keep <em>sacred water</em>,<br/>carved in silver and gold.</>,
    btn: 'About us',
  };
  return (
    <section className="Section theme-dark FullMediaHeadline" data-theme="dark" data-section="brand-statement" data-screen-label="04 Brand statement">
      <div className="FullMediaHeadline__media">
        {/* Still poster — ambient slow zoom via CSS (Ken Burns).
            Below the fold of the hero, so lazy + async is safe and saves
            ~4 MB on initial load. */}
        <picture>
          <source
            type="image/webp"
            srcSet="assets/photography/brand-statement-bg-960.webp 960w, assets/photography/brand-statement-bg-1440.webp 1440w, assets/photography/brand-statement-bg.webp 1920w"
            sizes="100vw"
          />
          <img
            className="FullMediaHeadline__bg"
            src="assets/photography/brand-statement-bg.jpg"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </picture>
        <div className="FullMediaHeadline__overlay"></div>
      </div>

      <div className="FullMediaHeadline__content">
        <span className="brand-wordmark">{t.wordmark}</span>
        <h2 className="display-headline">{t.head}</h2>
        <a className="Button Button--ghost" href="#about">
          {t.btn}
          <span className="Button__arrow">→</span>
        </a>
      </div>

      <CornerCrosses />
    </section>
  );
}

// ===========================================================
//  Section 5 — Newsletter
// ===========================================================
function SectionNewsletter({ lang }) {
  const [email, setEmail] = useS('');
  const [consent, setConsent] = useS(false);
  const [submitted, setSubmitted] = useS(false);

  const t = lang === 'es' ? {
    head: 'Suscríbete al boletín',
    sub: 'Recibe noticias de las próximas custodias antes que nadie. Una carta al mes — nunca dos.',
    email: 'Tu correo electrónico*',
    cta: 'Suscribirme',
    consent: <>Acepto la recolección de mis datos personales como se describe en la <a href="#privacy">Política de Privacidad</a>.</>,
    done: 'Gracias. Te escribiremos pronto.',
  } : {
    head: 'Subscribe to our newsletter',
    sub: 'Hear about upcoming custodies before anyone else. One letter a month — never two.',
    email: 'Your email*',
    cta: 'Sign up',
    consent: <>I agree to the collection and processing of my personal data as described in the <a href="#privacy">Privacy Policy</a>.</>,
    done: 'Thank you. You\'ll hear from us soon.',
  };

  function onSubmit(e) {
    e.preventDefault();
    // TODO: integrate with newsletter service (Mailchimp / Klaviyo / Brevo)
    setSubmitted(true);
  }

  return (
    <section className="Section theme-dark Section--banner" data-theme="dark" data-section="newsletter" data-screen-label="05 Newsletter">
      <div className="NewsletterBanner">
        <picture className="NewsletterBanner__bg">
          <source
            type="image/webp"
            srcSet="assets/photography/newsletter-bg-960.webp 960w, assets/photography/newsletter-bg-1440.webp 1440w, assets/photography/newsletter-bg.webp 1920w"
            sizes="100vw"
          />
          <img src="assets/photography/newsletter-bg.jpg" alt="" loading="lazy" decoding="async"/>
        </picture>

        <div className="NewsletterBanner__content">
          <Container>
            <div className="NewsletterBanner__inner">
              <h2 className="NewsletterBanner__title">{t.head}</h2>
              <p className="NewsletterBanner__sub">{t.sub}</p>

              {submitted ? (
                <div className="NewsletterForm__done">{t.done}</div>
              ) : (
                <form className="NewsletterForm" onSubmit={onSubmit}>
                  <div className="NewsletterForm__row">
                    <label className="floating-label">
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder=" "
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <span>{t.email}</span>
                    </label>
                    <button type="submit" className="Button Button--primary" disabled={!consent}>
                      {t.cta}
                      <span className="Button__arrow">→</span>
                    </button>
                  </div>

                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="consent"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span className="checkbox__box" aria-hidden></span>
                    <span className="checkbox__text">{t.consent}</span>
                  </label>
                </form>
              )}
            </div>
          </Container>
        </div>

        <CornerCrosses />
      </div>
    </section>
  );
}

// ===========================================================
//  Section 6 — Outro wordmark
// ===========================================================
function SectionOutroWordmark() {
  return (
    <section className="Section theme-dark" data-theme="dark" data-section="outro" data-screen-label="06 Outro">
      <div className="OutroWordmark">
        <span className="OutroWordmark__text">elyxie</span>
      </div>
      <CornerCrosses />
    </section>
  );
}

// ===========================================================
//  Section 7 — Footer
// ===========================================================
const FOOTER_COLS = {
  es: [
    { h: 'Ediciones', items: ['ÁNGEL DE LA LAGUNA NEGRA', 'MAMAYACU', 'HUARINGA', 'UKU PACHA'] },
    { h: 'Materia',    items: ['CRISTAL SOPLADO', 'ALUMINATO DE ESTRONCIO'] },
    { h: 'Sobre nosotros', items: ['Relato', 'Custodia', 'Ritual', 'Atelier en Lima'] },
    { h: 'Adicional',  items: ['Mayoristas', 'Servicio', 'Trabaja con nosotros'] },
    { h: 'Documentos', items: ['Política de Privacidad', 'Términos y Condiciones', 'Aviso Legal', 'Cookies'] },
    { h: 'Contacto',   items: ['+51 1 388 9912', '+51 1 388 9955'], contact: true, cta: 'Contáctanos' },
  ],
  en: [
    { h: 'Editions', items: ['ANGEL OF THE BLACK LAGOON', 'MAMAYACU', 'HUARINGA', 'UKU PACHA'] },
    { h: 'Matter',     items: ['HAND-BLOWN GLASS', 'STRONTIUM ALUMINATE'] },
    { h: 'About us',   items: ['Story', 'Custody', 'Ritual', 'Atelier in Lima'] },
    { h: 'Additional', items: ['Dealers', 'Service', 'Jobs'] },
    { h: 'Documents',  items: ['Privacy Policy', 'Terms & Conditions', 'Imprint', 'Cookies'] },
    { h: 'Contact',    items: ['+51 1 388 9912', '+51 1 388 9955'], contact: true, cta: 'Contact us' },
  ],
};

function Footer({ lang }) {
  // Mobile accordion: track which column is open
  const [openIdx, setOpenIdx] = useS(-1);
  const [isMobile, setIsMobile] = useS(false);

  useE(() => {
    const mq = window.matchMedia('(max-width: 810px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cols = FOOTER_COLS[lang];

  return (
    <footer className="Footer theme-dark" data-theme="dark" data-section="footer" data-screen-label="07 Footer">
      <Container>
        <nav className="Footer__cols" aria-label="Footer">
          {cols.map((col, i) => {
            const open = isMobile ? openIdx === i : true;
            return (
              <div key={col.h} className={`Footer__col ${col.contact ? 'Footer__col--contact' : ''} ${open ? 'is-open' : ''}`}>
                <h4 onClick={() => isMobile && setOpenIdx(openIdx === i ? -1 : i)}>
                  {col.h}
                  <span className="Footer__chev" aria-hidden>{open ? '−' : '+'}</span>
                </h4>
                <ul>
                  {col.items.map((it) => (
                    <li key={it}>
                      {col.contact && it.startsWith('+')
                        ? <a href={`tel:${it.replace(/\s/g, '')}`}>{it}</a>
                        : <a href="#">{it}</a>}
                    </li>
                  ))}
                </ul>
                {col.cta && (
                  <a className="Button Button--ghost Button--small" href="#contact">
                    {col.cta}
                    <span className="Button__arrow">→</span>
                  </a>
                )}
              </div>
            );
          })}
        </nav>

        <div className="Footer__bottom">
          <ul className="Footer__social" aria-label="Social media">
            <li><a href="#" aria-label="Instagram"><InstagramIcon/></a></li>
            <li><a href="#" aria-label="Facebook"><FacebookIcon/></a></li>
            <li><a href="#" aria-label="YouTube"><YoutubeIcon/></a></li>
            <li><a href="#" aria-label="Pinterest"><PinterestIcon/></a></li>
          </ul>
          <p className="Footer__copy">
            © 2026 ELYXIE · {lang === 'es' ? 'Custodios de Mamayacu · Lima, Perú' : 'Custodians of Mamayacu · Lima, Peru'}
          </p>
        </div>
      </Container>

      {/* Footer keeps ONLY the top crosses */}
      <CornerCrosses topOnly/>
    </footer>
  );
}

// ── tiny social glyphs ────────────────────────────────────────
function InstagramIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
  </svg>;
}
function FacebookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.5-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V9.9H7.6V13h2.6v8h3.3z"/>
  </svg>;
}
function YoutubeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 8.2a3 3 0 0 0-2-2c-1.8-.5-9-.5-9-.5s-7.2 0-9 .5a3 3 0 0 0-2 2c-.4 1.8-.4 3.8-.4 3.8s0 2 .4 3.8a3 3 0 0 0 2 2c1.8.5 9 .5 9 .5s7.2 0 9-.5a3 3 0 0 0 2-2c.4-1.8.4-3.8.4-3.8s0-2-.4-3.8zM9.5 15.5v-7l6 3.5-6 3.5z"/>
  </svg>;
}
function PinterestIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.2 9.3-.1-.8-.2-2 0-2.9.2-.8 1.2-5.1 1.2-5.1s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.6-4.4-3.1 0-5 2.3-5 4.8 0 1 .4 2 .8 2.6.1.1.1.2.1.3-.1.3-.2 1-.3 1.1 0 .2-.2.2-.4.1-1.2-.6-2-2.4-2-3.8 0-3.1 2.3-6 6.5-6 3.4 0 6.1 2.4 6.1 5.7 0 3.4-2.1 6.2-5.1 6.2-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.9-.8 2-1.2 2.6.9.3 1.9.4 2.9.4 5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
  </svg>;
}

// ── Export to window so app.jsx can consume ────────────────────
Object.assign(window, {
  CornerCrosses, Container,
  SectionVideoHero, SectionInstagramGrid, SectionBrandStatement,
  SectionNewsletter, SectionOutroWordmark, Footer,
});
