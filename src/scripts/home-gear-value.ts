import { revealCollectionValue } from './collection-value-roll';

const amount = document.querySelector<HTMLElement>('[data-home-gear-amount]');
const note = document.querySelector<HTMLElement>('[data-home-gear-note]');
if (amount && note) {
 amount.dataset.state = 'pending';
 fetch('/api/gear').then(async response => {
  if (!response.ok) throw new Error('Collection unavailable');
  const { summary } = await response.json();
  if (!summary || !Number.isFinite(summary.totalValue)) throw new Error('Missing total');
  amount.dataset.state = 'ready';
  amount.textContent = summary.valuedItemCount
   ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(summary.totalValue)
   : 'Not yet estimated';
  note.textContent = summary.valuedItemCount < summary.itemCount
   ? `Based on ${summary.valuedItemCount} of ${summary.itemCount} items. Items without a value are excluded.`
   : 'Across the entire collection.';
  if (summary.valuedItemCount) revealCollectionValue(amount);
 }).catch(() => {
  amount.dataset.state = 'unavailable';
  amount.textContent = 'Collection value unavailable';
  note.textContent = 'Please try again shortly.';
 });
}
