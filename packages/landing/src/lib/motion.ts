// src/lib/motion.ts
// Centralised motion utilities — GSAP setup + reduced-motion gating + reveal observer.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

export function registerGsap() {
  if (registered || typeof window === 'undefined') return gsap;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
  return gsap;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lightweight IntersectionObserver-based reveal helper.
 * Adds `.is-in` to any element marked `.reveal` or `.reveal-stagger` as it scrolls into view.
 * CSS transitions handle the actual animation; this just toggles the class.
 */
export function initReveals(root: Document | HTMLElement = document) {
  if (prefersReducedMotion()) {
    root.querySelectorAll<HTMLElement>('.reveal, .reveal-stagger').forEach((el) => {
      el.classList.add('is-in');
    });
    return () => {};
  }

  const targets = root.querySelectorAll<HTMLElement>('.reveal, .reveal-stagger');
  if (!targets.length) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );

  targets.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/**
 * Animated number counter — counts from 0 to target when scrolled into view.
 * Uses GSAP for smooth easing.
 */
export function initCounters(root: Document | HTMLElement = document) {
  const gsapLib = registerGsap();
  const reduced = prefersReducedMotion();
  const counters = root.querySelectorAll<HTMLElement>('[data-counter]');

  counters.forEach((el) => {
    const target = parseFloat(el.dataset.counter ?? '0');
    const decimals = parseInt(el.dataset.counterDecimals ?? '0', 10);
    const prefix = el.dataset.counterPrefix ?? '';
    const suffix = el.dataset.counterSuffix ?? '';

    if (reduced) {
      el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
      return;
    }

    const state = { val: 0 };
    gsapLib.to(state, {
      val: target,
      duration: 2,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => {
        el.textContent = `${prefix}${state.val.toFixed(decimals)}${suffix}`;
      },
    });
  });
}

export { gsap, ScrollTrigger };
