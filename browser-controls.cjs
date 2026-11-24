const controlSelector = [
  'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea',
  '[role=button]', '[role=link]', '[role=tab]', '[role=checkbox]', '[role=radio]', '[role=menuitem]',
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
  const searchButton = submit && form.method === 'get' && new URL(form.action, location.href).origin === location.origin &&
    element.type !== 'image' && !element.hasAttribute('formaction') &&
    Boolean(form.querySelector('input[type=search], input[name=q], input[name=search_query]'));
  const mediaControl = /(?:^|\s)(?:play|pause|resume|mute|unmute|fullscreen|volume)(?:\s|$)/i.test(name) &&
    Boolean(element.closest('[class*=player], [id*=player], [class*=video], [id*=video]'));
  return {
    role, tag, name, placeholder, mediaTile, mediaControl, submit, searchButton,
    actionHint: normalize([element.title, element.name, element.id, element.getAttribute('data-action')].filter(Boolean).join(' ')),
    type: element.getAttribute('type') || '', href: tag === 'a' ? element.href : '',
    download: element.hasAttribute('download'),
    search, searchSubmission: !form || (form.method === 'get' && new URL(form.action, location.href).origin === location.origin),
    sensitive: /password|passcode|captcha|verification|one.time|otp|credit.card|security.code|\bcvv\b|\bcvc\b|cc-/i.test(
      [element.type, element.name, element.id, element.autocomplete, name].join(' ')
    ),
  };
}

function allowsRoutineClick(control, frameUrl) {
  const significant = /\b(?:accept|agree|allow|apply for|authorize|buy|checkout|confirm|consent|delete|disable|download|erase|export|grant|install|join|login|log in|logout|log out|order|pay|post|publish|purchase|register|remove|reset password|revoke|save|send|share|sign in|sign out|sign up|subscribe|submit|transfer|unsubscribe|upload)\b/i;
  const significantSinhala = /මකන්න|ගෙවන්න|මිලදී|යවන්න|තහවුරු කරන්න|අවසර දෙන්න|එකඟ වෙන්න|ගිණුමක් සාදන්න/u;
  const action = (control.name + ' ' + (control.actionHint || '')).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
  if (control.submit && !control.searchButton || control.download || control.sensitive ||
      significant.test(action) || significantSinhala.test(action)) return false;
  if (control.role === 'link' && control.href) {
    const url = new URL(control.href);
    let route = url.pathname + ' ' + [...url.searchParams.keys()].join(' ');
    try { route = decodeURIComponent(route); } catch { /* Use the encoded route. */ }
    return url.protocol === 'https:' && !url.username && !url.password &&
      url.origin === new URL(frameUrl).origin && !significant.test(route.replace(/[_-]/g, ' '));
  }
  if (control.searchButton || control.mediaTile || control.mediaControl) return true;
  return ['video', 'tab', 'button', 'checkbox', 'radio', 'combobox', 'menuitem'].includes(control.role);
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
