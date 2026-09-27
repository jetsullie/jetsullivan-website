import '../styles/title-pop.css';

/** Add the same one-shot letter fall to a page title without changing its colors. */
export function initializeTitlePop(heading: HTMLElement) {
 if (heading.dataset.titlePopReady) return;
 heading.dataset.titlePopReady = 'true';
 heading.setAttribute('aria-label', heading.getAttribute('aria-label') || heading.innerText.replace(/\s+/g, ' ').trim());

 // Existing animated titles already have individual letters. Preserve that markup.
 if (!heading.querySelector('.hero-letter')) {
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
   const fragment = document.createDocumentFragment();
   for (const character of node.textContent || '') {
    if (/\s/.test(character)) { fragment.append(character); continue; }
    const letter = document.createElement('span');
    letter.className = 'title-pop-letter';
    letter.textContent = character;
    fragment.append(letter);
   }
   node.replaceWith(fragment);
  }
 }
 heading.querySelectorAll('[aria-hidden="true"]').forEach(layer => layer.removeAttribute('aria-hidden'));
 const letters = heading.querySelectorAll<HTMLElement>('.hero-letter,.title-pop-letter');
 letters.forEach(letter => {
  if (!letter.textContent?.trim()) return;
  letter.dataset.popLetter = '';
  letter.setAttribute('aria-label', `Pop letter ${letter.textContent}`);
  if (!(letter instanceof HTMLButtonElement)) {
   letter.setAttribute('role', 'button');
   letter.tabIndex = 0;
   letter.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) letter.click();
   });
  }
  letter.addEventListener('click', () => {
   if (letter.classList.contains('is-detached')) return;
   const rect = letter.getBoundingClientRect();
   const style = getComputedStyle(letter);
   const falling = document.createElement('span');
   falling.className = 'falling-letter';
   falling.setAttribute('aria-hidden', 'true');
   falling.textContent = letter.textContent;
   const homeColor = heading.matches('.hero-name') ? style.getPropertyValue('--letter-color').trim() : '';
   Object.assign(falling.style, {
    left:`${rect.left}px`, top:`${rect.top}px`, width:`${rect.width}px`, height:`${rect.height}px`,
    font:style.font, letterSpacing:style.letterSpacing, padding:style.padding, textTransform:style.textTransform,
    color:homeColor || style.color,
    backgroundImage:homeColor ? 'none' : style.backgroundImage,
    backgroundClip:homeColor ? 'border-box' : style.backgroundClip,
    webkitTextFillColor:homeColor || style.webkitTextFillColor,
    filter:homeColor ? `drop-shadow(0 0 12px ${homeColor})` : style.filter,
   });
   letter.classList.add('is-detached');
   if (letter instanceof HTMLButtonElement) letter.disabled = true;
   else { letter.removeAttribute('role'); letter.removeAttribute('tabindex'); letter.removeAttribute('aria-label'); }
   letter.style.setProperty('--letter-light', '0');
   letter.style.setProperty('--letter-x', '0px');
   letter.style.setProperty('--letter-y', '0px');
   document.body.append(falling);
   const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const gravity = 1400;
   const vy = -300;
   const vx = (Math.random() - .5) * 300;
   const spin = (Math.random() - .5) * 420;
   const drop = Math.max(0, innerHeight - rect.top + rect.height * 2);
   const duration = (-vy + Math.sqrt(vy * vy + 2 * gravity * drop)) / gravity;
   const frames = reduced ? [{opacity:1}, {opacity:0}] : Array.from({length:31}, (_, i) => {
    const t = i / 30 * duration;
    return {offset:i / 30, transform:`translate(${vx*t}px,${vy*t + .5*gravity*t*t}px) rotate(${spin*t}deg) scale(${1 + Math.sin(Math.min(1,i/6)*Math.PI)*.12})`};
   });
   const animation = falling.animate(frames, {duration:reduced ? 180 : duration*1000, easing:'linear', fill:'forwards'});
   animation.onfinish = () => falling.remove();
   animation.oncancel = () => falling.remove();
  });
 });
}
