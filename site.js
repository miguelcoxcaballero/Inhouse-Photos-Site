const copy = document.querySelector('#copy-url');
copy?.addEventListener('click', async () => {
  const endpoint = document.querySelector('#server-url')?.textContent?.trim();
  if (!endpoint) return;
  try {
    await navigator.clipboard.writeText(endpoint);
    copy.textContent = 'Copiada';
    window.setTimeout(() => { copy.textContent = 'Copiar'; }, 2500);
  } catch {
    window.getSelection()?.selectAllChildren(document.querySelector('#server-url'));
  }
});
