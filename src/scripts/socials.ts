import { initializeSiteMotion } from './site-motion';

// Match the homepage's pointer lighting and weighted glass layers.
document.querySelectorAll<HTMLElement>('.social-tab').forEach(card => {
 card.addEventListener('pointermove', event => {
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--glass-light-x', `${(event.clientX - rect.left) / rect.width * 100}%`);
  card.style.setProperty('--glass-light-y', `${(event.clientY - rect.top) / rect.height * 100}%`);
 });
});

initializeSiteMotion({
 canvasSelector: '.social-page',
 titleSelector: '#social-heading',
 sectionSelector: '.social-page,.social-header,.site-footer',
 stationarySelector: '.social-header,.site-footer',
});
