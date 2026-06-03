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
  const videoRef = useR(null);
  const [soundOn, setSoundOn] = useS(false);

  // Detecta móvil localmente (este componente vive fuera del Hero, que es
  // quien tiene su propio isNarrow). matchMedia sólo dispara al cruzar 767px.
  const [isNarrow, setIsNarrow] = useS(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  useE(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Máxima calidad en desktop/tablet (1080p), liviano en móvil (720p).
  const src = isNarrow ? 'assets/video/main-film-720.mp4' : 'assets/video/main-film.mp4';

  // Autoplay sólo mientras el filme está a la vista; pausa al salir para no
  // decodificar un 1080p fuera de pantalla. Muted es obligatorio para que el
  // navegador permita el autoplay.
  useE(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !soundOn;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: [0, 0.35, 0.6] }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !soundOn;
    v.muted = !next;
    if (next && v.paused) v.play().catch(() => {});
    setSoundOn(next);
  };

  const t = lang === 'es' ? {
    eyebrow: 'CINEMATOGRAFÍA · LAGUNA NEGRA',
    caption: 'El filme. Tres minutos en la cordillera, antes de bajar el agua.',
    sound: soundOn ? 'SILENCIAR' : 'ACTIVAR SONIDO',
  } : {
    eyebrow: 'CINEMATOGRAPHY · BLACK LAGOON',
    caption: 'The film. Three minutes in the cordillera, before the water descends.',
    sound: soundOn ? 'MUTE' : 'SOUND ON',
  };

  return (
    <section className="Section theme-light" data-theme="light" data-section="hero-video" data-screen-label="02 Video">
      <Container>
        <div className="VideoSection__eyebrow">
          <span className="VideoSection__line"></span>
          {t.eyebrow}
        </div>

        <figure className="MediaPlayer">
          <video
            key={src}
            ref={videoRef}
            className="MediaPlayer__video"
            playsInline muted loop
            preload="metadata"
            poster="assets/photography/main-film-poster-1440.jpg"
          >
            <source src={src} type="video/mp4"/>
          </video>

          <button
            className="PlayButton"
            onClick={toggleSound}
            aria-label={t.sound}
            aria-pressed={soundOn}
          >
            {soundOn ? (
              <svg width="16" height="14" viewBox="0 0 18 16" fill="none" aria-hidden>
                <path d="M1 5.5H4L8 2V14L4 10.5H1V5.5Z" fill="currentColor"/>
                <path d="M11 5C12.2 6.2 12.2 9.8 11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M13.5 3C15.8 5.2 15.8 10.8 13.5 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="14" viewBox="0 0 18 16" fill="none" aria-hidden>
                <path d="M1 5.5H4L8 2V14L4 10.5H1V5.5Z" fill="currentColor"/>
                <path d="M11.5 5.5L16 10.5M16 5.5L11.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            )}
            <span className="PlayButton__label">{t.sound}</span>
          </button>

          <CornerCrosses />
        </figure>

        <figcaption className="MediaPlayer__caption">{t.caption}</figcaption>
      </Container>
    </section>
  );
}

// ===========================================================
//  Section 3 — Provenance ("what the sphere holds")
// ===========================================================
function IconGeological() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <path d="M2.5 19h19L14 7l-3 4.6L8.7 8.2z"/>
  </svg>;
}
function IconAncestral() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 1.4c.55 4.9 1.7 6.05 6.6 6.6-4.9.55-6.05 1.7-6.6 6.6-.55-4.9-1.7-6.05-6.6-6.6 4.9-.55 6.05-1.7 6.6-6.6z"/>
    <path d="M18.5 15.2c.27 2.4.83 2.96 3.2 3.2-2.37.24-2.93.8-3.2 3.2-.27-2.4-.83-2.96-3.2-3.2 2.37-.24 2.93-.8 3.2-3.2z"/>
  </svg>;
}
function IconMetaphysical() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.4l7 2.6v5.4c0 4.7-3 7.9-7 9.6-4-1.7-7-4.9-7-9.6V5z"/>
  </svg>;
}

const PROVENANCE = [
  {
    Icon: IconGeological,
    es: { label: 'GEOLÓGICO', title: 'Nace a 3.957 metros', body: 'En lo más alto de los Andes, donde el aire escasea y el mundo se queda en silencio, la Laguna Negra guarda un agua que la montaña tardó siglos en reunir. No es un lago. Es un reservorio de tiempo.' },
    en: { label: 'GEOLOGICAL', title: 'Born at 3,957 meters', body: 'High in the Andes, where the air thins and the world falls silent, the Black Lagoon holds water the mountain took centuries to gather. It is not a lake. It is a reservoir of time.' },
  },
  {
    Icon: IconAncestral,
    es: { label: 'ANCESTRAL', title: '3.000 años de linaje', body: 'La evidencia arqueológica une este paisaje a las culturas Cupisnique y Chavín. Una red de caminos sagrados existió con un solo propósito: transportar esta agua.' },
    en: { label: 'ANCESTRAL', title: '3,000 years of lineage', body: 'Archaeological evidence ties this landscape to the Cupisnique and Chavín cultures. A network of sacred paths existed for a single purpose: to carry this water.' },
  },
  {
    Icon: IconMetaphysical,
    es: { label: 'METAFÍSICO', title: 'Mamayacu, la madre del agua', body: 'En la cosmovisión andina, la laguna no es un recurso: es un ser vivo. Mamayacu, el Agua Madre, capaz de absorber lo que pesa sobre una persona y devolverla limpia.' },
    en: { label: 'METAPHYSICAL', title: 'Mamayacu, mother of the water', body: 'In the Andean worldview, the lagoon is not a resource: it is a living being. Mamayacu, the Mother Water, able to absorb what weighs on a person and return them cleansed.' },
  },
];

function SectionProvenance({ lang }) {
  const t = lang === 'es'
    ? { eyebrow: 'PROCEDENCIA · LO QUE GUARDA LA ESFERA', head: <>No es un detalle estético.<br/><em>Es un núcleo energético.</em></> }
    : { eyebrow: 'PROVENANCE · WHAT THE SPHERE HOLDS', head: <>Not an aesthetic detail.<br/><em>An energetic core.</em></> };

  return (
    <section className="Section theme-dark" data-theme="dark" data-section="provenance" data-screen-label="03 Provenance">
      <Container>
        <p className="eyebrow-label Provenance__eyebrow">{t.eyebrow}</p>
        <h2 className="Provenance__head">{t.head}</h2>

        <ul className="ProvenanceGrid">
          {PROVENANCE.map((c, i) => {
            const Icon = c.Icon;
            return (
              <li key={i} className="ProvenanceCard">
                <span className="ProvenanceCard__icon" aria-hidden><Icon/></span>
                <span className="ProvenanceCard__label">{c[lang].label}</span>
                <h3 className="ProvenanceCard__title">{c[lang].title}</h3>
                <p className="ProvenanceCard__body">{c[lang].body}</p>
              </li>
            );
          })}
        </ul>

        <CornerCrosses/>
      </Container>
    </section>
  );
}

// ===========================================================
//  Section 4 — Certificate ("first edition")
//  Byte-perfect port of the example's EditionCertificate.jsx
//  (same structure, copy, values, assets & design tokens).
//  Fixed (non-localized) strings match the source exactly:
//  the SACRED WATER tag, the dual product name, date & jeweler.
// ===========================================================
function SectionCertificate({ lang }) {
  const t = lang === 'es' ? {
    eyebrow: 'CERTIFICADO  ·  PRIMERA EDICIÓN',
    title: 'Numerado. Reservado. Atestiguado.',
    body: 'Cada pieza lleva un número de serie grabado a mano, firmado por el maestro joyero, acompañado de un certificado en papel sellado con el monograma de elyxie.',
    issued: 'Emitido', by: 'Maestro joyero', seal: 'Sellado',
  } : {
    eyebrow: 'CERTIFICATE  ·  FIRST EDITION',
    title: 'Numbered. Reserved. Witnessed.',
    body: 'Each piece carries a hand-engraved serial, signed by the master jeweler, accompanied by a paper certificate sealed with the elyxie monogram.',
    issued: 'Issued', by: 'Master jeweler', seal: 'Sealed',
  };

  return (
    <section className="Section theme-dark Certificate" data-theme="dark" data-section="certificate" data-screen-label="04 Certificate">
      <div className="Certificate__halo" aria-hidden></div>
      <div className="Container Certificate__inner">
        <div className="Certificate__eyebrow">{t.eyebrow}</div>
        <h2 className="Certificate__title">{t.title}</h2>
        <p className="Certificate__body">{t.body}</p>

        <div className="Cert">
          <div className="Cert__bg" aria-hidden></div>
          <div className="Cert__head">
            <div className="Cert__brand"><span className="elyxie-logo" role="img" aria-label="elyxie"></span></div>
            <div className="Cert__tag">Sacred Waters<br/>Ancestral Jewelry</div>
          </div>
          <div className="Cert__name">Ángel de la Laguna Negra</div>
          <div className="Cert__nameEn">Angel of the Black Lagoon</div>
          <div className="Cert__serial">N.º 01 / 100</div>
          <div className="Cert__grid">
            <div>
              <div className="Cert__label">{t.issued}</div>
              <div className="Cert__value">Lima · Perú</div>
              <div className="Cert__value">20 · 05 · 2026</div>
            </div>
            <div>
              <div className="Cert__label">{t.by}</div>
              <div className="Cert__signature">J. Zamora</div>
            </div>
            <div className="Cert__sealCol">
              <div className="Cert__label">{t.seal}</div>
              <img className="Cert__sealImg" src="assets/elyxie-mark.svg" alt="" aria-hidden/>
            </div>
          </div>
        </div>
      </div>
      <CornerCrosses/>
    </section>
  );
}

// ===========================================================
//  Section 5 — #elyxie Instagram grid (3 cards, mixed ratios)
// ===========================================================
// Los 3 últimos posts reales de @elyxie.es (capturados de la cuenta).
// Para refrescarlos: re-leer el feed y actualizar base/url/fecha/caption.
const INSTA = [
  {
    base: 'assets/photography/insta-real-01',
    ratio: '0.78 / 1',           // 1080×1351 · 4:5
    url:  'https://www.instagram.com/p/DXZeeXljrPa/',
    dateEs: '21 ABRIL 2026', dateEn: 'APRIL 21, 2026',
    es: 'Algunas piezas están hechas para verse. Otras están hechas para trascender.',
    en: 'Some pieces are made to be seen. Others are made to transcend.',
  },
  {
    base: 'assets/photography/insta-real-02',
    ratio: '1 / 1',              // reel 9:16 → recortado a cuadrado
    url:  'https://www.instagram.com/p/DXQbIq2juC5/',
    dateEs: '17 ABRIL 2026', dateEn: 'APRIL 17, 2026',
    es: 'Toda historia tiene un origen. La nuestra comienza en el silencio, en las aguas sagradas de la Laguna Negra de Huancabamba, Perú.',
    en: 'Every story has an origin. Ours begins in silence, in the sacred waters of Laguna Negra in Huancabamba, Peru.',
  },
  {
    base: 'assets/photography/insta-real-03',
    ratio: '0.78 / 1',           // 1080×1395 · ~4:5
    url:  'https://www.instagram.com/p/DW9fnC8jmHL/',
    dateEs: '10 ABRIL 2026', dateEn: 'APRIL 10, 2026',
    es: 'En los momentos más oscuros, siempre hay algo que te guía. ELYXIE no es solo lo que llevas, es lo que ilumina tu camino.',
    en: 'In the darkest moments, there is always something that guides you. ELYXIE is not just what you wear, it is what illuminates your path.',
  },
];

// Mes/año en vivo para el eyebrow ("SOCIALES · JUNIO 2026"); se actualiza solo.
const FEED_MONTHS = {
  es: ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'],
  en: ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'],
};

function SectionInstagramGrid({ lang }) {
  const now = new Date();
  const eyebrow = (lang === 'es' ? 'SOCIALES · ' : 'SOCIAL · ') + FEED_MONTHS[lang][now.getMonth()] + ' ' + now.getFullYear();
  return (
    <section className="Section theme-light" data-theme="light" data-section="elyxie-feed" data-screen-label="05 Instagram">
      <Container>
        <div className="SectionHead">
          <h2 className="SectionHead__title">#elyxie</h2>
          <div className="SectionHead__meta">
            <span>{eyebrow}</span>
            <a className="SectionHead__link" href="https://www.instagram.com/elyxie.es/" target="_blank" rel="noopener">
              {lang === 'es' ? 'VER MÁS' : 'VIEW MORE'} →
            </a>
          </div>
        </div>

        <ul className="InstaGrid">
          {INSTA.map((p, i) => {
            const webp = `${p.base}.webp`;
            const webp480 = `${p.base}-480.webp`;
            const date = lang === 'es' ? p.dateEs : p.dateEn;
            return (
            <li key={i} className="InstaCard">
              <a href={p.url} target="_blank" rel="noopener" aria-label={`Instagram · ${date}`}>
                <figure className="InstaCard__media" style={{ aspectRatio: p.ratio }}>
                  <picture>
                    <source
                      type="image/webp"
                      srcSet={`${webp480} 480w, ${webp} 720w`}
                      sizes="(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <img src={`${p.base}.jpg`} alt="" loading="lazy" decoding="async"/>
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
                  <span className="InstaCard__handle">{date}</span>
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
//  Section 7 — Footer (newsletter + footer)
//  Byte-perfect port of the example's Footer.jsx — the email
//  capture and the footer columns are a single component.
// ===========================================================
const FOOT_COPY = {
  en: {
    eyebrow: 'JOIN THE CIRCLE',
    title: 'The lagoon, in your inbox.',
    body: 'A quiet letter, monthly. New rituals, new pieces, the next opening of the edition.',
    placeholder: 'Your email',
    button: 'Reserve',
    discreet: 'We do not share addresses. Ever.',
    brandBody: 'A single piece, hand-crafted in Lima, with water gathered from the Black Lagoon of Huancabamba.',
    columns: [
      { title: 'ELYXIE', links: ['Story', 'The lagoon', 'Master jeweler', 'Press'] },
      { title: 'SHOP',   links: ['Ángel de la Laguna Negra', 'Coming soon', 'Care', 'Returns'] },
      { title: 'REACH',  links: ['WhatsApp', 'Email', 'Instagram', 'Lima · Perú'] },
    ],
    copy: '© 2026 elyxie  ·  Sacred water from the Black Lagoon of Huancabamba',
  },
  es: {
    eyebrow: 'ÚNETE AL CÍRCULO',
    title: 'La laguna, en tu bandeja.',
    body: 'Una carta silenciosa, cada mes. Nuevos rituales, nuevas piezas, la próxima apertura de la edición.',
    placeholder: 'Tu correo',
    button: 'Reservar',
    discreet: 'No compartimos direcciones. Nunca.',
    brandBody: 'Una sola pieza, hecha a mano en Lima, con agua recolectada de la Laguna Negra de Huancabamba.',
    columns: [
      { title: 'ELYXIE', links: ['Relato', 'La laguna', 'Maestro joyero', 'Prensa'] },
      { title: 'TIENDA', links: ['Ángel de la Laguna Negra', 'Próximamente', 'Cuidado', 'Devoluciones'] },
      { title: 'CONTACTO', links: ['WhatsApp', 'Correo', 'Instagram', 'Lima · Perú'] },
    ],
    copy: '© 2026 elyxie  ·  Agua sagrada de la Laguna Negra de Huancabamba',
  },
};

// feather-style line icons (stroke 1.5) — matches the source Icons.jsx
function FootIcon({ children }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const FootIgIcon   = () => <FootIcon><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></FootIcon>;
const FootWaIcon   = () => <FootIcon><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></FootIcon>;
const FootMailIcon = () => <FootIcon><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></FootIcon>;

function Footer({ lang }) {
  const t = FOOT_COPY[lang];
  return (
    <footer className="SiteFooter" data-theme="dark" data-section="footer" data-screen-label="07 Footer">
      <div className="SiteFooter__halo" aria-hidden></div>
      <div className="Container SiteFooter__inner">
        <div className="FootNews">
          <div>
            <div className="FootNews__eyebrow">{t.eyebrow}</div>
            <h2 className="FootNews__title">{t.title}</h2>
            <p className="FootNews__body">{t.body}</p>
          </div>
          <div className="FootForm">
            <div className="FootForm__row">
              <input className="FootForm__input" type="email" placeholder={t.placeholder}/>
              <button className="FootForm__submit">{t.button}</button>
            </div>
            <div className="FootForm__discreet">{t.discreet}</div>
          </div>
        </div>

        <div className="FootLower">
          <div className="FootBrand">
            <div className="FootBrand__name"><span className="elyxie-logo" role="img" aria-label="elyxie"></span></div>
            <div className="FootBrand__tag">SACRED WATERS</div>
            <div className="FootBrand__body">{t.brandBody}</div>
            <div className="FootSocials">
              <a className="FootSocial" href="https://www.instagram.com/elyxie.es/" target="_blank" rel="noopener" aria-label="Instagram"><FootIgIcon/></a>
              <button className="FootSocial" aria-label="WhatsApp"><FootWaIcon/></button>
              <button className="FootSocial" aria-label="Email"><FootMailIcon/></button>
            </div>
          </div>
          {t.columns.map((col) => (
            <div key={col.title}>
              <div className="FootCol__title">{col.title}</div>
              <div className="FootCol__list">
                {col.links.map((l) => <span key={l} className="FootCol__link">{l}</span>)}
              </div>
            </div>
          ))}
        </div>

        <div className="FootCopy">
          <div className="FootCopy__text">{t.copy}</div>
          <div className="FootCopy__name"><span className="elyxie-logo" role="img" aria-label="elyxie"></span></div>
        </div>
      </div>
    </footer>
  );
}

// ── Export to window so app.jsx can consume ────────────────────
Object.assign(window, {
  CornerCrosses, Container,
  SectionVideoHero, SectionProvenance, SectionCertificate,
  SectionInstagramGrid, Footer,
});
