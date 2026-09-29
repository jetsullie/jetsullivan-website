type Bubble = {
 element: HTMLElement; x: number; y: number; vx: number; vy: number;
 left: number; top: number; width: number; height: number; held: boolean; phase: number;
};

// Resolve expanding bounds without moving the card currently being read.
export function separateBubbles(states: Bubble[]) {
 for (let pass = 0; pass < 8; pass++) {
  for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
   const a = states[i], b = states[j];
   if (a.held && b.held) continue;
   const dx = b.left + b.x + b.width / 2 - a.left - a.x - a.width / 2;
   const dy = b.top + b.y + b.height / 2 - a.top - a.y - a.height / 2;
   const ox = (a.width + b.width) / 2 + 6 - Math.abs(dx);
   const oy = (a.height + b.height) / 2 + 6 - Math.abs(dy);
   if (ox <= 0 || oy <= 0) continue;
   const axis = ox < oy ? 'x' : 'y', velocity = ox < oy ? 'vx' : 'vy';
   const sign = (ox < oy ? dx : dy) >= 0 ? 1 : -1;
   const overlap = Math.min(ox, oy);
   const share = a.held ? 0 : b.held ? 1 : .5;
   a[axis] -= overlap * sign * share;
   b[axis] += overlap * sign * (1 - share);
   const approaching = (a[velocity] - b[velocity]) * sign;
   if (approaching > 0) {
    a[velocity] -= approaching * sign * 1.25 * share;
    b[velocity] += approaching * sign * 1.25 * (1 - share);
   }
  }
 }
}

const fullExcerpts = new WeakMap<HTMLElement, string>();
const excerptWidths = new WeakMap<HTMLElement, number>();

export function preparePostPreview(card: HTMLElement) {
 const date = card.querySelector('time');
 const description = card.querySelector<HTMLElement>('.entry-copy > p');
 if (description) fullExcerpts.set(description, description.textContent || '');
 card.querySelectorAll('.entry-card-actions,.entry-source').forEach(element => element.remove());
 date?.remove();
 const surface = document.createElement('div');
 surface.className = 'entry-surface';
 surface.append(...Array.from(card.childNodes));
 card.append(surface);
 if (date) { date.className = 'entry-date'; card.append(date); }
}

// Fit at character boundaries, reserving space for a literal "...".
function fitPostExcerpt(card: HTMLElement) {
 const title = card.querySelector<HTMLElement>('.entry-copy h2');
 if (title) card.style.setProperty('--bubble-title-height', `${title.offsetHeight}px`);
 const description = card.querySelector<HTMLElement>('.entry-copy > p');
 if (!description) return;
 const width = description.getBoundingClientRect().width;
 if (!width || excerptWidths.get(description) === width) return;
 excerptWidths.set(description, width);
 const full = fullExcerpts.get(description) || '';
 const style = getComputedStyle(description);
 const measure = document.createElement('div');
 Object.assign(measure.style, {
  position:'fixed', left:'0', top:'0', visibility:'hidden', pointerEvents:'none',
  width:`${width}px`, font:style.font, letterSpacing:style.letterSpacing,
  lineHeight:style.lineHeight, whiteSpace:'normal', overflowWrap:'anywhere',
 });
 document.body.append(measure);
 const limit = parseFloat(style.lineHeight) * 3 + .5;
 const fits = (text: string) => { measure.textContent = text; return measure.getBoundingClientRect().height <= limit; };
 if (fits(full)) description.textContent = full;
 else {
  const chars = Array.from(full);
  let low = 0, high = chars.length;
  while (low < high) {
   const middle = Math.ceil((low + high) / 2);
   if (fits(chars.slice(0,middle).join('').trimEnd() + '...')) low = middle;
   else high = middle - 1;
  }
  description.textContent = chars.slice(0,low).join('').trimEnd() + '...';
 }
 measure.remove();
}

export function initializePostBubbles() {
 document.querySelectorAll<HTMLElement>('.post-bubbles').forEach(grid => {
  if (grid.dataset.bubblesReady) return;
  grid.dataset.bubblesReady = 'true';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let states: Bubble[] = [];
  let frame = 0, previous = 0, clock = 0;
  let visible = false, needsLayout = true;
  let pointer: {x:number; y:number} | null = null;
  const observer = new ResizeObserver(entries => {
   needsLayout = true; start();
   for (const entry of entries) if (entry.target !== grid) fitPostExcerpt(entry.target as HTMLElement);
  });
  observer.observe(grid);
  const paint = (s: Bubble) => {
   s.element.style.setProperty('--bubble-x', `${s.x.toFixed(3)}px`);
   s.element.style.setProperty('--bubble-y', `${s.y.toFixed(3)}px`);
  };
  const paused = () => reduced.matches || document.hidden || !visible || document.body.classList.contains('post-dialog-open');
  function start() { if (!frame && !paused() && states.length) { previous = performance.now(); frame = requestAnimationFrame(tick); } }
  function tick(now: number) {
   frame = 0;
   if (paused()) return;
   const step = Math.min(2, (now - previous) / (1000 / 60)); previous = now; clock += step / 60;
   if (needsLayout) {
    for (const s of states) {
     s.left = s.element.offsetLeft; s.top = s.element.offsetTop;
     s.width = s.element.offsetWidth; s.height = s.element.offsetHeight;
    }
    needsLayout = false;
   }
   const bounds = grid.getBoundingClientRect();
   const limit = 90;
   const active = grid.querySelector('.entry-card:hover') || (document.activeElement?.matches(':focus-visible') ? grid.querySelector('.entry-card:has(:focus-visible)') : null);
   for (const s of states) {
    // Keep keyboard targets steady; mouse interaction follows the title's spring.
    s.held = s.element === active;
    if (s.held) { s.vx = 0; s.vy = 0; continue; }
    const restingY = Math.sin(clock * .65 + s.phase) * 2;
    if (pointer) {
     const dx = bounds.left + s.left + s.width / 2 + s.x - pointer.x;
     const dy = bounds.top + s.top + s.height / 2 + s.y - pointer.y;
     const distance = Math.hypot(dx, dy) || 1;
     const radius = Math.max(s.width, s.height) * .65;
     if (distance < radius) {
      const pressure = (radius - distance) / radius;
      s.vx += dx / distance * pressure * .9 * step;
      s.vy += dy / distance * pressure * .9 * step;
     }
    }
    // Same spring and damping as JET SULLIVAN, with a softer cursor push.
    s.vx = (s.vx - s.x * .095 * step) * Math.pow(.79, step);
    s.vy = (s.vy - (s.y - restingY) * .095 * step) * Math.pow(.79, step);
    s.x = Math.max(-limit, Math.min(limit, s.x + s.vx * step));
    s.y = Math.max(-limit, Math.min(limit, s.y + s.vy * step));
   }
   separateBubbles(states);
   for (const s of states) {
    paint(s);
    if (pointer && s.element.matches(':hover')) {
     s.element.style.setProperty('--glass-light-x', `${pointer.x - bounds.left - s.left - s.x}px`);
     s.element.style.setProperty('--glass-light-y', `${pointer.y - bounds.top - s.top - s.y}px`);
    }
   }
   frame = requestAnimationFrame(tick);
  }
  const refresh = () => {
   for (const s of states) observer.unobserve(s.element);
   states = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .entry-card:not(.status-card)'), (element, i) => {
    observer.observe(element);
    element.addEventListener('pointerleave', () => {
     ['--thumb-x','--thumb-y','--thumb-skew-x','--thumb-skew-y'].forEach(name => element.style.removeProperty(name));
     const currentActive = document.activeElement;
     if (currentActive instanceof HTMLElement && element.contains(currentActive) && !currentActive.matches(':focus-visible')) {
      currentActive.blur();
     }
    });
    return {element,x:0,y:0,vx:0,vy:0,left:0,top:0,width:0,height:0,held:false,phase:i*2.4};
   });
   needsLayout = true; start();
  };
  new MutationObserver(refresh).observe(grid, {childList:true});
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; start(); }).observe(grid);
  document.addEventListener('pointermove', event => {
   pointer = event.pointerType === 'mouse' ? {x:event.clientX,y:event.clientY} : null;
  }, {passive:true});
  grid.addEventListener('pointermove', event => {
   const card = (event.target as Element).closest<HTMLElement>('.entry-card');
   if (!card) return;
   const rect = card.getBoundingClientRect();
   card.style.setProperty('--glass-light-x', `${event.clientX - rect.left}px`);
   card.style.setProperty('--glass-light-y', `${event.clientY - rect.top}px`);
   if (reduced.matches || event.pointerType !== 'mouse') return;
   const surface = card.querySelector('.entry-surface')?.getBoundingClientRect();
   if (!surface) return;
   const x = Math.max(-1,Math.min(1,(event.clientX - surface.left) / surface.width * 2 - 1));
   const y = Math.max(-1,Math.min(1,(event.clientY - surface.top) / surface.height * 2 - 1));
   card.style.setProperty('--thumb-x', `${x * 4}px`);
   card.style.setProperty('--thumb-y', `${y * 3}px`);
   card.style.setProperty('--thumb-skew-x', `${-y * .6}deg`);
   card.style.setProperty('--thumb-skew-y', `${x * .6}deg`);
  }, {passive:true});
  // Clicking the page clears a card's retained focus and its expanded state.
  document.addEventListener('pointerdown', event => {
   if (document.body.classList.contains('post-dialog-open')) return;
   const focused = document.activeElement;
   if (!(focused instanceof HTMLElement)) return;
   const card = focused.closest('.entry-card');
   if (card && grid.contains(card) && !card.contains(event.target as Node)) focused.blur();
  });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; });
  document.addEventListener('visibilitychange', start);
  window.addEventListener('post-dialog:change', start);
  reduced.addEventListener('change', () => {
   if (reduced.matches) { cancelAnimationFrame(frame); frame = 0; for (const s of states) { s.x=s.y=s.vx=s.vy=0; paint(s); } }
   else start();
  });
  refresh();
  document.fonts.ready.then(() => {
   for (const s of states) {
    const p = s.element.querySelector<HTMLElement>('.entry-copy > p');
    if (p) excerptWidths.delete(p);
    fitPostExcerpt(s.element);
   }
  });
 });
}

if (typeof document !== 'undefined') {
 const blurActiveBubble = (event: Event) => {
  const card = (event.target as Element | null)?.closest('.entry-card');
  if (!card) {
   const currentActive = document.activeElement;
   if (currentActive instanceof HTMLElement && currentActive.closest('.post-bubbles .entry-card')) {
    currentActive.blur();
   }
  }
 };
 document.addEventListener('pointerdown', blurActiveBubble, true);
 document.addEventListener('click', blurActiveBubble, true);
}
