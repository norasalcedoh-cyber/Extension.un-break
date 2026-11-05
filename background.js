// Session-only state, keyed by the sender tab. No browsing content is stored.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return;
  let url;
  try { url = new URL(sender.url); } catch { return; }
  if (url.origin !== 'https://www.instagram.com') return;
  if (message?.type === 'ascii:image') {
    (async () => {
      const imageUrl = new URL(message.url);
      if (imageUrl.protocol !== 'https:' ||
          !['cdninstagram.com', 'fbcdn.net'].some((host) =>
            imageUrl.hostname === host || imageUrl.hostname.endsWith(`.${host}`))) {
        throw new Error('Unsupported image host');
      }
      const response = await fetch(imageUrl.href, { credentials: 'omit' });
      if (!response.ok) throw new Error('Image unavailable');
      const mime = response.headers.get('content-type')?.split(';')[0];
      if (!mime?.startsWith('image/')) throw new Error('Not an image');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      respond({ ok: true, dataUrl: `data:${mime};base64,${btoa(binary)}` });
    })().catch(() => respond({ ok: false }));
    return true;
  }
  if (!message || !['demo:get', 'demo:set'].includes(message.type)) return;
  if (message.type === 'demo:set' && typeof message.enabled !== 'boolean') return;
  const key = `demo-tab-${sender.tab.id}`;
  (async () => {
    if (message.type === 'demo:set') {
      if (message.enabled) await chrome.storage.session.set({ [key]: true });
      else await chrome.storage.session.remove(key);
    }
    const state = await chrome.storage.session.get(key);
    respond({ ok: true, enabled: state[key] === true });
  })().catch(() => respond({ ok: false }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`demo-tab-${tabId}`).catch(() => {});
});
