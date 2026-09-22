type SiteMotionOptions = {
 canvasSelector: string;
 titleSelector: string;
 sectionSelector: string;
 stationarySelector: string;
};

/** The homepage and Socials share the same split-title physics and scene motion. */
export function initializeSiteMotion(options: SiteMotionOptions) {
// Match the alternate title color to the hero's diagonal at every viewport size.
const heroCanvas = document.querySelector<HTMLElement>(options.canvasSelector);
const heroTitle = document.querySelector<HTMLElement>(options.titleSelector);
const homeMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const alignTitleDivide = () => {
  if (!heroCanvas || !heroTitle) return;
  const canvas = heroCanvas.getBoundingClientRect();
  const start = window.matchMedia('(max-width:650px)').matches ? .66 : .61;
  const slope = .13 * canvas.width / canvas.height;
  const angle = Math.atan(slope);
  // Color the actual glyphs instead of clipping a duplicate moving title.
  const paints = Array.from(heroTitle.querySelectorAll<HTMLElement>('.hero-letter'), letter => {
   const rect = letter.getBoundingClientRect();
   const edge = canvas.left + canvas.width * start - slope * (rect.top + rect.height / 2 - canvas.top);
   const length = rect.width * Math.cos(angle) + rect.height * Math.sin(angle);
   return { letter, stop: length / 2 + (edge - rect.left - rect.width / 2) * Math.cos(angle) };
  });
  for (const { letter, stop } of paints) {
   letter.style.setProperty('--letter-angle', `${90 + angle * 180 / Math.PI}deg`);
   letter.style.setProperty('--letter-divide', `${stop}px`);
  }
 };
if (heroCanvas && heroTitle) {
 new ResizeObserver(alignTitleDivide).observe(heroCanvas);
 window.addEventListener('resize', alignTitleDivide);
 document.fonts.ready.then(alignTitleDivide);
 alignTitleDivide();
}

// Give each title letter the same anchored collision feel as a Brainstorm bubble.
if (heroTitle) {
 const baseLetters = Array.from(heroTitle.querySelectorAll<HTMLElement>('.hero-name-base .hero-letter'));
 const letterLayers = baseLetters.map(letter => Array.from(heroTitle.querySelectorAll<HTMLElement>(`.hero-letter[data-letter-index="${letter.dataset.letterIndex}"]`)));
 const states = baseLetters.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, rotation: 0, light: 0 }));
 let pointerX = 0;
 let pointerY = 0;
 let pointerActive = false;
 let titleFrame = 0;
 let previousTitleTime = 0;

 const renderTitlePhysics = (time: number) => {
  const step = Math.min(2, Math.max(.25, (time - previousTitleTime) / 16.67));
  previousTitleTime = time;
  let moving = false;
  const rectangles = baseLetters.map(letter => letter.getBoundingClientRect());
  states.forEach((state, index) => {
   const letter = baseLetters[index];
   const rect = rectangles[index];
   let targetLight = 0;
   if (pointerActive && letter.textContent?.trim()) {
    const centerX = rect.left + rect.width / 2 - state.x;
    const centerY = rect.top + rect.height / 2 - state.y;
    const dx = centerX + state.x - pointerX;
    const dy = centerY + state.y - pointerY;
    const distance = Math.hypot(dx, dy) || 1;
    const radius = Math.max(58, rect.height * .72);
    if (distance < radius) {
     const pressure = (radius - distance) / radius;
     state.vx += dx / distance * pressure * 1.3 * step;
     state.vy += dy / distance * pressure * 1.3 * step;
     targetLight = Math.min(1, pressure * 1.7);
    }
   }
   state.vx = (state.vx - state.x * .095 * step) * Math.pow(.79, step);
   state.vy = (state.vy - state.y * .095 * step) * Math.pow(.79, step);
   const minX = Math.max(-14, -(rect.left - state.x));
   const maxX = Math.min(14, window.innerWidth - (rect.right - state.x));
   state.x = Math.max(minX, Math.min(maxX, state.x + state.vx * step));
   state.y = Math.max(-12, Math.min(12, state.y + state.vy * step));
   state.light += (targetLight - state.light) * .2;
   for (const layer of letterLayers[index]) {
    layer.style.setProperty('--letter-x', `${state.x.toFixed(2)}px`);
    layer.style.setProperty('--letter-y', `${state.y.toFixed(2)}px`);
    layer.style.setProperty('--letter-rotate', `${state.rotation.toFixed(2)}deg`);
    layer.style.setProperty('--letter-light', state.light.toFixed(3));
   }
   moving ||= Math.abs(state.x) + Math.abs(state.y) + Math.abs(state.vx) + Math.abs(state.vy) + state.light > .08;
  });
  alignTitleDivide();
  if (moving || pointerActive) titleFrame = requestAnimationFrame(renderTitlePhysics);
  else titleFrame = 0;
 };
 const startTitlePhysics = () => { if (!titleFrame && !homeMotionPreference.matches) { previousTitleTime = performance.now(); titleFrame = requestAnimationFrame(renderTitlePhysics); } };
 heroTitle.addEventListener('pointermove', event => {
  pointerX = event.clientX;
  pointerY = event.clientY;
  pointerActive = event.pointerType === 'mouse';
  startTitlePhysics();
 });
 heroTitle.addEventListener('pointerleave', () => {
  pointerActive = false;
  startTitlePhysics();
 });
 homeMotionPreference.addEventListener('change', () => {
  cancelAnimationFrame(titleFrame);
  titleFrame = 0;
  pointerActive = false;
  states.forEach((state, index) => {
   Object.assign(state, {x:0,y:0,vx:0,vy:0,light:0});
   for (const letter of letterLayers[index]) {
    letter.style.setProperty('--letter-x', '0px');
    letter.style.setProperty('--letter-y', '0px');
    letter.style.setProperty('--letter-light', '0');
   }
  });
  alignTitleDivide();
 });
}

// Layer pointer parallax with a damped scroll offset so every section has weight.
const homeSections = Array.from(document.querySelectorAll<HTMLElement>(options.sectionSelector));
if (homeSections.length) {
 const states = homeSections.map(() => ({ pointerX: 0, pointerY: 0, scroll: 0, layers: [0,1,2].map(() => ({position:0,velocity:0})) }));
 let targetPointerX = 0;
 let targetPointerY = 0;
 let motionFrame = 0;
 let previousMotionTime = performance.now();
 const renderHomeMotion = (time: number) => {
  const step = Math.min(2, Math.max(.25, (time - previousMotionTime) / 16.67));
  previousMotionTime = time;
  let moving = false;
  homeSections.forEach((section, index) => {
   const state = states[index];
   const rect = section.getBoundingClientRect();
   const scrollTarget = section.matches(options.stationarySelector) ? 0 : Math.max(-1, Math.min(1, (window.innerHeight / 2 - (rect.top + rect.height / 2)) / window.innerHeight));
   state.pointerX += (targetPointerX - state.pointerX) * .065;
   state.pointerY += (targetPointerY - state.pointerY) * .065;
   state.scroll += (scrollTarget - state.scroll) * .055;
   section.style.setProperty('--home-scene-x', `${(state.pointerX * (window.innerWidth <= 650 ? 2 : 5)).toFixed(2)}px`);
   section.style.setProperty('--home-scene-y', `${(state.pointerY * 4).toFixed(2)}px`);
   section.style.setProperty('--home-bg-x', `${(state.pointerX * -18).toFixed(2)}px`);
   section.style.setProperty('--home-bg-y', `${(state.pointerY * -14).toFixed(2)}px`);
   section.style.setProperty('--home-far-x', `${(state.pointerX * -6).toFixed(2)}px`);
   section.style.setProperty('--home-far-y', `${(state.pointerY * -5).toFixed(2)}px`);
   section.style.setProperty('--home-deep-x', `${(state.pointerX * -12).toFixed(2)}px`);
   section.style.setProperty('--home-deep-y', `${(state.pointerY * -9).toFixed(2)}px`);
   section.style.setProperty('--home-scroll-scene', `${(state.scroll * 8).toFixed(2)}px`);
   // Larger glass pieces accelerate slowly; smaller pieces catch up sooner.
   const distances = window.innerWidth <= 650 ? [22,28,34] : [42,64,84];
   state.layers.forEach((layer, depth) => {
    const target = -scrollTarget * distances[depth];
    const stiffness = [.018,.026,.036][depth];
    const damping = [.85,.82,.79][depth];
    layer.velocity = (layer.velocity + (target - layer.position) * stiffness * step) * Math.pow(damping,step);
    layer.position += layer.velocity * step;
    const unsettled = Math.abs(target - layer.position) + Math.abs(layer.velocity) > .03;
    if (!unsettled) { layer.position = target; layer.velocity = 0; }
    section.style.setProperty(`--home-scroll-${['far','deep','near'][depth]}`, `${layer.position.toFixed(2)}px`);
    moving ||= unsettled;
   });
   moving ||= Math.abs(targetPointerX - state.pointerX) + Math.abs(targetPointerY - state.pointerY) + Math.abs(scrollTarget - state.scroll) > .002;
  });
  alignTitleDivide();
  if (moving) motionFrame = requestAnimationFrame(renderHomeMotion);
  else motionFrame = 0;
 };
 const startHomeMotion = () => { if (!motionFrame && !homeMotionPreference.matches && !document.hidden) { previousMotionTime = performance.now(); motionFrame = requestAnimationFrame(renderHomeMotion); } };
 window.addEventListener('pointermove', event => {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  targetPointerX = (event.clientX / window.innerWidth - .5) * 2;
  targetPointerY = (event.clientY / window.innerHeight - .5) * 2;
  startHomeMotion();
 }, { passive: true });
 window.addEventListener('scroll', startHomeMotion, { passive: true });
 window.addEventListener('resize', startHomeMotion, { passive: true });
 homeMotionPreference.addEventListener('change', () => {
  cancelAnimationFrame(motionFrame);
  motionFrame = 0;
  if (homeMotionPreference.matches) {
   homeSections.forEach(section => {
    for (const property of Array.from(section.style)) if (property.startsWith('--home-')) section.style.removeProperty(property);
   });
   states.forEach(state => { Object.assign(state, {pointerX:0,pointerY:0,scroll:0}); state.layers.forEach(layer => Object.assign(layer,{position:0,velocity:0})); });
   alignTitleDivide();
  } else startHomeMotion();
 });
 document.documentElement.addEventListener('mouseleave', () => {
  targetPointerX = 0;
  targetPointerY = 0;
  startHomeMotion();
 });
 startHomeMotion();
}

}
