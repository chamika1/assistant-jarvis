const controlSelector = [
  'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea',
  '[role=button]', '[role=link]', '[role=tab]', '[role=checkbox]', '[role=radio]',
  '[tabindex="0"]', '[onclick]', '[data-id]', '[data-channel-id]', 'video',
].join(',');

function describeControl(element) {
  const tag = element.localName;
  const role = element.getAttribute('role') || ({
    a: 'link', button: 'button', input: element.type === 'search' ? 'searchbox' : 'textbox',
    textarea: 'textbox', select: 'combobox', video: 'video',
  })[tag] || 'tile';
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const label = normalize([...element.labels || []].map(item => item.innerText).join(' '));
  const placeholder = normalize(element.getAttribute('placeholder'));
  const text = tag === 'select' ? '' : normalize(element.innerText);
  const tileTitle = role === 'tile' && element.querySelector('.ch-name, [data-title], h2, h3, h4')?.innerText;
  const search = tag === 'input' && (element.type === 'search' || /(?:^|[_-])search(?:$|[_-])/i.test(element.name));
  const name = normalize(element.getAttribute('aria-label') || label || placeholder || tileTitle || text || element.title || (search ? 'Search' : tag === 'video' ? 'Video player' : ''));
  const mediaTile = role === 'tile' && [...element.querySelectorAll('span, button')].some(child => child.innerText?.trim().toLowerCase() === 'play');
  const form = element.closest('form');
  const submit = Boolean(form && (element.type === 'submit' || element.type === 'image' || element.hasAttribute('formaction')));
  const mediaControl = /(?:^|\s)(?:play|pause|resume|mute|unmute|fullscreen|volume)(?:\s|$)/i.test(name) &&
    Boolean(element.closest('[class*=player], [id*=player], [class*=video], [id*=video]'));
  return {
    role, tag, name, placeholder, mediaTile, mediaControl, submit,
    type: element.getAttribute('type') || '', href: tag === 'a' ? element.href : '',
    download: element.hasAttribute('download'),
    search, searchSubmission: !form || (form.method === 'get' && new URL(form.action, location.href).origin === location.origin),
    sensitive: /password|passcode|captcha|verification|one.time|otp|credit.card|security.code|\bcvv\b|\bcvc\b|cc-/i.test(
      [element.type, element.name, element.id, element.autocomplete, name].join(' ')
    ),
  };
}

function allowsRoutineClick(control, frameUrl) {
  const significant = /\b(?:accept|agree|allow|authorize|buy|checkout|confirm|delete|download|grant|install|login|log in|logout|log out|order|pay|publish|purchase|register|remove|send|share|sign in|sign out|sign up|subscribe|submit|upload)\b/i;
  if (control.submit || control.download || control.sensitive || significant.test(control.name)) return false;
  if (control.role === 'link' && control.href) {
    const url = new URL(control.href);
    return url.protocol === 'https:' && !url.username && !url.password &&
      url.origin === new URL(frameUrl).origin && !significant.test(decodeURIComponent(url.pathname + ' ' + url.search).replace(/[_-]/g, ' '));
  }
  return control.role === 'video' || control.mediaTile || control.mediaControl || control.role === 'tab' ||
    /^(?:[^\p{L}\p{N}]*\s*)?(?:live tv|explore movies|next page|previous page|play|pause)(?:\s*[^\p{L}\p{N}]*)$/iu.test(control.name);
}

const describeAll = new Function('elements', `return elements.slice(0, 450).map(${describeControl.toString()})`);

async function visibleControls(tab, query = '') {
  const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = [];
  for (const frame of tab.frames().slice(0, 12)) {
    if (!frame.url().startsWith('https:')) continue;
    if (frame.parentFrame()) {
      const frameElement = await frame.frameElement().catch(() => null);
      if (!frameElement) continue;
      const visible = await frameElement.isVisible().catch(() => false);
      await frameElement.dispose().catch(() => {});
      if (!visible) continue;
    }
    const controls = frame.locator(controlSelector).filter({ visible: true });
    const descriptions = await controls.evaluateAll(describeAll).catch(() => []);
    for (const [index, info] of descriptions.entries()) {
      if (!info?.name || !words.every(word => (info.name + ' ' + info.placeholder).toLowerCase().includes(word))) continue;
      const target = controls.nth(index);
      matches.push({ frame, target, info });
      if (matches.length === 100) return matches;
    }
  }
  return matches;
}

async function playbackSnapshot(tab) {
  const media = [];
  for (const frame of tab.frames().slice(0, 12)) {
    if (!frame.url().startsWith('https:')) continue;
    const statuses = await frame.locator('video').filter({ visible: true }).evaluateAll(videos => videos.map(video => ({
      state: video.error ? 'error' : video.ended ? 'ended' : video.paused ? 'paused' : video.readyState >= 2 ? 'playing' : 'buffering',
      currentTime: video.currentTime,
      errorCode: video.error?.code || undefined,
    }))).catch(() => []);
    media.push(...statuses);
  }
  return media;
}

module.exports = { allowsRoutineClick, describeControl, playbackSnapshot, visibleControls };
