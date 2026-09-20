import '../styles/collection-value-roll.css';

/** Reveal each digit once, when a loaded collection total enters the viewport. */
export function revealCollectionValue(amount: HTMLElement) {
  if (amount.dataset.valueReveal) return;
  amount.dataset.valueReveal = 'pending';
  const formatted = amount.textContent || '';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches || !/\d/.test(formatted)) {
    amount.dataset.valueReveal = 'complete';
    return;
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .7)) return;
    observer.disconnect();
    if (reducedMotion.matches) {
      amount.dataset.valueReveal = 'complete';
      return;
    }

    amount.dataset.valueReveal = 'running';
    // Announce the final value only; the moving reels are decorative.
    const label = document.createElement('span');
    label.className = 'value-roll-label';
    label.textContent = formatted;
    const display = document.createElement('span');
    display.setAttribute('aria-hidden', 'true');
    const style = getComputedStyle(amount);
    const animations: Animation[] = [];
    let digitIndex = 0;

    for (const character of formatted) {
      if (!/\d/.test(character)) {
        display.append(character);
        continue;
      }
      const reel = document.createElement('span');
      reel.className = 'value-roll-reel';
      const placeholder = document.createElement('span');
      placeholder.className = 'value-roll-placeholder';
      placeholder.textContent = character;
      const track = document.createElement('span');
      track.className = 'value-roll-track';
      const steps = 10 + Number(character);
      // Reverse the strip so successive digits enter from above as it moves down.
      for (let step = steps; step >= 0; step--) {
        const symbol = document.createElement('span');
        symbol.className = 'value-roll-symbol';
        symbol.textContent = String(step % 10);
        if (style.backgroundImage !== 'none') {
          symbol.style.backgroundImage = style.backgroundImage;
          symbol.style.backgroundSize = style.backgroundSize;
          symbol.style.backgroundClip = 'text';
        }
        track.append(symbol);
      }
      reel.append(placeholder, track);
      display.append(reel);
      const animation = track.animate(
        [{ transform: `translateY(-${steps * 1.12}em)` }, { transform: 'translateY(0)' }],
        { duration: 1150 + digitIndex++ * 65, easing: 'cubic-bezier(.18,.65,.25,1)', fill: 'both' },
      );
      animations.push(animation);
    }
    amount.replaceChildren(label, display);
    const finish = () => {
      // Return to ordinary text to preserve the original gradient and kerning.
      display.textContent = formatted;
      amount.dataset.valueReveal = 'complete';
      reducedMotion.removeEventListener('change', onMotionChange);
    };
    const onMotionChange = () => {
      if (reducedMotion.matches) animations.forEach(animation => animation.finish());
    };
    reducedMotion.addEventListener('change', onMotionChange);
    void Promise.all(animations.map(animation => animation.finished)).then(finish);
  }, { threshold: .7 });
  observer.observe(amount);
}
