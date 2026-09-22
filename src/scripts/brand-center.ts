import { initializeSiteMotion } from './site-motion';

initializeSiteMotion({canvasSelector:'.brand-hero',titleSelector:'#brand-title',sectionSelector:'.scene',stationarySelector:'.brand-header'});

document.querySelectorAll<HTMLElement>('.glass-button').forEach(button => {
 button.addEventListener('pointermove', event => {
  const rect = button.getBoundingClientRect();
  button.style.setProperty('--glass-light-x', `${(event.clientX - rect.left) / rect.width * 100}%`);
  button.style.setProperty('--glass-light-y', `${(event.clientY - rect.top) / rect.height * 100}%`);
 });
});

const status = document.querySelector<HTMLElement>('.copy-status');
let copyTimer: ReturnType<typeof setTimeout>;
document.querySelectorAll<HTMLButtonElement>('[data-copy-color]').forEach(button => {
 button.addEventListener('click', async () => {
  const color = button.dataset.copyColor;
  if (!color || !status) return;
  clearTimeout(copyTimer);
  try {
   await navigator.clipboard.writeText(color);
   status.textContent = `${color} copied`;
  } catch {
   status.textContent = `Copy this color: ${color}`;
  }
  copyTimer = setTimeout(() => { status.textContent = ''; }, 3500);
 });
});
