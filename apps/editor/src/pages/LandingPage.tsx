import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePageMeta } from '../seo/usePageMeta';
import { SkipLink } from '../a11y/SkipLink';
import { LiveRegion } from '../a11y/LiveRegion';
import { useRouteWarmup } from '../hooks/useRouteWarmup';
import { trackCta } from '../analytics/trackCta';
import { LandingBeforeAfter } from './landing/LandingBeforeAfter';
import { LandingCtaLink } from './landing/LandingCtaLink';
import {
  ArrowUpRightIcon,
  BrushIcon,
  CropIcon,
  ScissorsIcon,
  SparklesIcon,
  WandIcon,
} from './landingIcons';

const warmEditor = () => import('../app/EditorShell');

const CAPABILITIES = [
  {
    index: '01',
    name: 'Layers',
    line: 'Blend modes, masks, smart objects — stacked like glass plates under safelight.',
    tint: 'copper',
  },
  {
    index: '02',
    name: 'Neural Lab',
    line: 'Cutout, Revive, Clarity, Outpaint. Local first — cloud when you want more firepower.',
    tint: 'teal',
  },
  {
    index: '03',
    name: 'Stock & CC',
    line: 'Place free-licence photos on the canvas, then export or save the project to the cloud.',
    tint: 'ink',
  },
  {
    index: '04',
    name: 'Retouch',
    line: 'Heal, clone, dodge, burn, liquify — brush the negative until it sings.',
    tint: 'copper',
  },
] as const;

const PLATES = [
  { id: 'a', label: 'BASE', hue: 'copper', fanX: -70, fanY: 28, fanR: -18 },
  { id: 'b', label: 'ADJ', hue: 'ink', fanX: -28, fanY: -18, fanR: 10 },
  { id: 'c', label: 'MASK', hue: 'teal', fanX: 36, fanY: 22, fanR: 14 },
  { id: 'd', label: 'FX', hue: 'copper', fanX: 62, fanY: -26, fanR: -8 },
  { id: 'e', label: 'LIVE', hue: 'paper', fanX: 0, fanY: -8, fanR: 0 },
] as const;

const PLATE_COUNT = PLATES.length;
const SWIPE_COMMIT_PX = 56;

/** Signed offset of plate i relative to front index (−2…2 for 5 plates). */
function plateOffset(i: number, front: number): number {
  let d = i - front;
  const half = Math.floor(PLATE_COUNT / 2);
  if (d > half) d -= PLATE_COUNT;
  if (d < -half) d += PLATE_COUNT;
  return d;
}

const ORBIT_TOOLS = [
  { id: 'brush', label: 'Brush', Icon: BrushIcon, angle: 18 },
  { id: 'crop', label: 'Crop', Icon: CropIcon, angle: 95 },
  { id: 'wand', label: 'Wand', Icon: WandIcon, angle: 168 },
  { id: 'cut', label: 'Cutout', Icon: ScissorsIcon, angle: 248 },
  { id: 'lab', label: 'Lab', Icon: SparklesIcon, angle: 312 },
] as const;

const FILM_FRAMES = ['NEG·01', 'NEG·02', 'NEG·03', 'NEG·04', 'NEG·05', 'NEG·06', 'NEG·07', 'NEG·08'];

/** Marketing entry — maximalist industrial darkroom, deep CSS 3D interaction. */
export const LandingPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    rx: number;
    ry: number;
    mode: 'none' | 'swipe' | 'tilt';
  } | null>(null);
  const [fanned, setFanned] = useState(false);
  const [exposure, setExposure] = useState(0.55);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);
  /** Index of the front-most plate (swipe carousel). */
  const [front, setFront] = useState(PLATE_COUNT - 1);
  const [swipeDrag, setSwipeDrag] = useState(0);
  const frontLabel = PLATES[front]?.label ?? 'LIVE';

  const cycleFront = useCallback((dir: 1 | -1) => {
    setFanned(false);
    setSwipeDrag(0);
    setFront((i) => (i + dir + PLATE_COUNT) % PLATE_COUNT);
  }, []);

  usePageMeta({
    title: 'PhotoshopLite — Free Browser Photo Editor | Layers, AI Cutout & Revive',
    description:
      'Free darkroom-grade photo editor in your browser. Layers, retouch tools, AI background removal, Photo Revive, cleanup, upscale, and optional cloud Neural Lab — no install.',
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    canonicalPath: '/',
    ogTitle: 'PhotoshopLite — Free Browser Photo Editor',
  });

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useRouteWarmup(warmEditor);

  // Scroll parallax
  useEffect(() => {
    const onScroll = () => {
      const el = rootRef.current;
      if (!el || reducedMotion.current) return;
      const y = el.scrollTop;
      el.style.setProperty('--sy', `${y.toFixed(0)}px`);
      el.style.setProperty('--sp', `${Math.min(1, y / 520).toFixed(3)}`);
    };
    const el = rootRef.current;
    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => el?.removeEventListener('scroll', onScroll);
  }, []);

  const applyTilt = useCallback((nx: number, ny: number, boost = 1) => {
    const el = rootRef.current;
    if (!el || reducedMotion.current) return;
    const rx = (0.5 - ny) * 18 * boost;
    const ry = (nx - 0.5) * 26 * boost;
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--px', `${((nx - 0.5) * 40).toFixed(1)}px`);
    el.style.setProperty('--py', `${((ny - 0.5) * 28).toFixed(1)}px`);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      el.style.setProperty('--lx', `${nx * 100}%`);
      el.style.setProperty('--ly', `${ny * 100}%`);
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      el.style.setProperty('--my', `${e.clientY - rect.top + el.scrollTop}px`);

      const drag = dragRef.current;
      if (drag?.active) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;

        if (drag.mode === 'none' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          drag.mode =
            Math.abs(dx) > Math.abs(dy) * 1.15 ? 'swipe' : 'tilt';
        }

        if (drag.mode === 'swipe') {
          setSwipeDrag(dx);
          return;
        }

        if (reducedMotion.current) return;
        const rx = drag.rx + dy * 0.12;
        const ry = drag.ry + dx * 0.14;
        el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
        el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        setSpin((s) => s + dx * 0.08);
        return;
      }

      applyTilt(nx, Math.min(1, Math.max(0, ny)));
    },
    [applyTilt]
  );

  const handlePointerLeave = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (dragRef.current?.active) return;
    el.style.setProperty('--rx', '10deg');
    el.style.setProperty('--ry', '-14deg');
    el.style.setProperty('--px', '0px');
    el.style.setProperty('--py', '0px');
    setSwipeDrag(0);
  }, []);

  const onStackPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button.landing__orb')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = rootRef.current;
    const rx = parseFloat(el?.style.getPropertyValue('--rx') || '10') || 10;
    const ry = parseFloat(el?.style.getPropertyValue('--ry') || '-14') || -14;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY, rx, ry, mode: 'none' };
  }, []);

  const onStackPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.mode === 'swipe') {
        const dx = e.clientX - drag.x;
        if (dx <= -SWIPE_COMMIT_PX) cycleFront(1);
        else if (dx >= SWIPE_COMMIT_PX) cycleFront(-1);
        else setSwipeDrag(0);
      } else {
        setSwipeDrag(0);
      }
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [cycleFront]
  );

  const tiltCap = useCallback((e: React.PointerEvent<HTMLLIElement>) => {
    if (reducedMotion.current) return;
    const node = e.currentTarget;
    const r = node.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    node.style.setProperty('--crx', `${(-ny * 14).toFixed(2)}deg`);
    node.style.setProperty('--cry', `${(nx * 18).toFixed(2)}deg`);
  }, []);

  const untiltCap = useCallback((e: React.PointerEvent<HTMLLIElement>) => {
    e.currentTarget.style.setProperty('--crx', '0deg');
    e.currentTarget.style.setProperty('--cry', '0deg');
  }, []);

  return (
    <div
      ref={rootRef}
      className={`landing${fanned ? ' landing--fanned' : ''}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ '--exposure': String(exposure), '--spin': `${spin}deg` } as React.CSSProperties}
    >
      <SkipLink href="#landing-cta">Skip to open editor</SkipLink>
      <SkipLink href="#landing-stack">Skip to layer stack</SkipLink>

      <div className="landing__mesh" aria-hidden />
      <div className="landing__beam" aria-hidden />
      <div className="landing__safelight" aria-hidden />
      <div className="landing__grain" aria-hidden />
      <div className="landing__floor" aria-hidden />
      <div className="landing__cursor" aria-hidden />
      <div className="landing__dust" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ '--di': String(i) } as React.CSSProperties} />
        ))}
      </div>

      <LiveRegion
        message={
          fanned
            ? 'Layer stack fanned open. Press Enter or Space on a plate to collapse.'
            : `Front plate: ${frontLabel}. Swipe left or right to browse layers.`
        }
      />

      <main className="landing__hero">
        <header className="landing__top">
          <span className="landing__mark" aria-hidden>
            Ps
          </span>
          <span className="landing__top-meta font-mono-ui">DARKROOM / 3D STAGE</span>
          <span className="landing__top-meta landing__top-meta--right font-mono-ui">
            ISO 400 · F/{(1.4 + exposure * 4).toFixed(1)}
          </span>
        </header>

        <p className="landing__kicker font-mono-ui">
          <span className="landing__kicker-dot" aria-hidden />
          Safelight on · swipe stack · ← {frontLabel} →
        </p>

        <h1 className="landing__brand font-display">
          <span className="landing__brand-row landing__brand-row--a">Photoshop</span>
          <span className="landing__brand-row landing__brand-row--b">
            <em>Lite</em>
            <i className="landing__brand-rule" aria-hidden />
          </span>
        </h1>

        <div className="landing__hero-split">
          <div className="landing__lede">
            <p className="landing__headline font-display">Develop photos in the browser.</p>
            <p className="landing__sub">
              Layers, retouch and AI — no install, no upload. Swipe the stack left/right to cycle
              plates, Enter to fan, orbit tools to preview.
            </p>
            <div className="landing__lede-row">
              <LandingCtaLink
                to="/editor"
                id="landing-cta"
                cta="hero_open_editor"
                className="landing__cta"
                onMouseEnter={() => {
                  void warmEditor();
                }}
                onFocus={() => {
                  void warmEditor();
                }}
              >
                <span>Open editor</span>
                <ArrowUpRightIcon size={18} strokeWidth={2.4} />
              </LandingCtaLink>
              <label className="landing__dial font-mono-ui">
                <span>EXP {Math.round(exposure * 100)}</span>
                <input
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.01}
                  value={exposure}
                  onChange={(e) => setExposure(Number(e.target.value))}
                  aria-label="Exposure"
                />
              </label>
            </div>
          </div>

          <div
            id="landing-stack"
            className={`landing__viewport${swipeDrag !== 0 ? ' is-swiping' : ''}`}
            onPointerDown={onStackPointerDown}
            onPointerUp={onStackPointerUp}
            onPointerCancel={onStackPointerUp}
            role="region"
            aria-roledescription="carousel"
            aria-label={`Layer stack, front plate ${frontLabel}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setFanned((v) => !v);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                cycleFront(-1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                cycleFront(1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                setFront(0);
                setFanned(false);
              } else if (e.key === 'End') {
                e.preventDefault();
                setFront(PLATE_COUNT - 1);
                setFanned(false);
              }
            }}
          >
            <p className="sr-only">
              Swipe left or right, or use arrow keys, to cycle glass plates. Enter fans the stack.
              Current front plate: {frontLabel}.
            </p>

            <div className="landing__swipe-nav" role="group" aria-label="Browse plates">
              <button
                type="button"
                className="landing__swipe-btn"
                aria-label="Previous plate"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleFront(-1);
                }}
              >
                ←
              </button>
              <span className="landing__swipe-meter font-mono-ui" aria-hidden>
                {front + 1}/{PLATE_COUNT}
              </span>
              <button
                type="button"
                className="landing__swipe-btn"
                aria-label="Next plate"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleFront(1);
                }}
              >
                →
              </button>
            </div>

            <div className="landing__scene">
              <div className="landing__orbit-ring" role="toolbar" aria-label="Demo tools">
                {ORBIT_TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`landing__orb${activeTool === t.id ? ' is-on' : ''}`}
                    style={{ '--oa': `${t.angle}deg` } as React.CSSProperties}
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={activeTool === t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTool((cur) => {
                        const next = cur === t.id ? null : t.id;
                        if (next) trackCta('landing_orbit_tool', { tool: next });
                        return next;
                      });
                    }}
                  >
                    <t.Icon size={14} strokeWidth={2.2} aria-hidden />
                  </button>
                ))}
              </div>

              <div className="landing__orbit" role="group" aria-label="Glass plates">
                {PLATES.map((p, i) => {
                  const off = plateOffset(i, front);
                  const isFront = off === 0;
                  const dragX = fanned ? 0 : swipeDrag * (1 - Math.abs(off) * 0.12);
                  const z = fanned ? 28 - Math.abs(off) * 8 : 36 - Math.abs(off) * 38;
                  const x = fanned ? p.fanX : off * 58 + dragX * 0.35;
                  const y = fanned ? p.fanY : Math.abs(off) * 6;
                  const rot = fanned ? p.fanR + off * 2 : off * 7 - swipeDrag * 0.02;
                  const scale = fanned ? 0.92 : 1 - Math.abs(off) * 0.05;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`landing__plate landing__plate--${p.hue}${isFront ? ' is-front' : ''}`}
                      style={
                        {
                          '--pz': `${z}px`,
                          '--prot': `${rot}deg`,
                          '--pi': String(i),
                          '--fx': `${p.fanX}px`,
                          '--fy': `${p.fanY}px`,
                          '--fr': `${p.fanR}deg`,
                          '--sx': `${x}px`,
                          '--sy': `${y}px`,
                          '--ss': String(scale),
                          zIndex: 20 - Math.abs(off),
                        } as React.CSSProperties
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isFront) {
                          setFront(i);
                          setFanned(false);
                          setSwipeDrag(0);
                          return;
                        }
                        setFanned((v) => !v);
                      }}
                      aria-label={`${p.label} plate${isFront ? ', front' : ''}${fanned ? ', fanned' : ''}. ${isFront ? 'Activate to fan stack.' : 'Activate to bring to front.'}`}
                      aria-current={isFront ? 'true' : undefined}
                      aria-pressed={isFront && fanned}
                    >
                      <div className="landing__plate-face">
                        <span className="landing__plate-chip font-mono-ui">{p.label}</span>
                        <div className="landing__plate-grid" />
                        <div className="landing__plate-photo" />
                        <span className="landing__plate-shine" />
                      </div>
                      <div className="landing__plate-edge" />
                    </button>
                  );
                })}
                <div className="landing__float-badge font-mono-ui">
                  {fanned ? 'FANNED' : frontLabel}
                </div>
              </div>
              <div className="landing__shadow" />
            </div>
            <p className="landing__tool-hint font-mono-ui" aria-hidden>
              {activeTool
                ? `Tool locked · ${activeTool.toUpperCase()}`
                : 'Swipe ← → · click plate'}
            </p>
          </div>
        </div>

        <div className="landing__film" aria-hidden>
          <div className="landing__film-track">
            {[...FILM_FRAMES, ...FILM_FRAMES].map((f, i) => (
              <span key={`${f}-${i}`} className="landing__film-cell">
                <i />
                <b className="font-mono-ui">{f}</b>
              </span>
            ))}
          </div>
        </div>

        <footer className="landing__scroll font-mono-ui">
          <span>Scroll</span>
          <i />
        </footer>
      </main>

      <section className="landing__bench" aria-label="Workbench preview">
        <div className="landing__bench-copy">
          <p className="landing__caps-label font-mono-ui">Workbench · parallax</p>
          <h2 className="landing__bench-title font-display">A darkroom that moves with you.</h2>
          <p className="landing__sub">
            Tools orbit the plate. Exposure warms the safelight. Double-click the stack to fan five
            glass negatives into space.
          </p>
        </div>
        <div className="landing__desk" aria-hidden>
          <div className="landing__desk-chrome">
            <span />
            <span />
            <span />
          </div>
          <div className="landing__desk-stage">
            <div className="landing__desk-canvas">
              <div className="landing__desk-photo" />
              <div className="landing__desk-march" />
            </div>
            <aside className="landing__desk-rail">
              <i />
              <i />
              <i />
              <i />
              <i />
            </aside>
          </div>
        </div>
      </section>

      <LandingBeforeAfter />

      <section className="landing__caps" aria-label="Capabilities">
        <p className="landing__caps-label font-mono-ui">On the bench · hover to lift</p>
        <ul className="landing__caps-list">
          {CAPABILITIES.map((c) => (
            <li
              key={c.name}
              className={`landing__cap landing__cap--${c.tint}`}
              onPointerMove={tiltCap}
              onPointerLeave={untiltCap}
            >
              <div className="landing__cap-plate">
                <span className="landing__cap-index font-mono-ui">{c.index}</span>
                <span className="landing__cap-name font-display">{c.name}</span>
                <span className="landing__cap-line">{c.line}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="landing__outro">
          <LandingCtaLink
            to="/editor"
            cta="outro_open_editor"
            className="landing__cta landing__cta--ghost"
            onMouseEnter={() => {
              void warmEditor();
            }}
          >
            <span>Open editor</span>
            <ArrowUpRightIcon size={18} strokeWidth={2.4} />
          </LandingCtaLink>
          <span className="landing__legal font-mono-ui">PhotoshopLite · local-first</span>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
