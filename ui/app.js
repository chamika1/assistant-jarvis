const get = id => document.getElementById(id);
const api = window.mithra;
const history = [];
const profiles = {
  openai: { key: '', model: 'gpt-4o-mini', url: '' },
  deepseek: { key: '', model: 'deepseek-chat', url: '' },
  custom: { key: '', model: '', url: '' },
};
let folder;
get('choose-folder').onclick = async () => {
  folder = await api.pickFolder();
  if (!folder) return;
  get('choose-folder').textContent = 'Change folder';
  get('choose-folder').title = folder;
  get('cli').checked = true;
  get('activity').textContent = folder;
};

function selectedFolder() {
  return get('cli').checked ? folder : undefined;
}

let provider = 'openai';
let voice;
let busy = false;

function message(role, text) {
  const entry = document.createElement('div');
  entry.className = 'message ' + role;
  const title = document.createElement('strong');
  title.textContent = role === 'user' ? 'You' : 'Mithra';
  const body = document.createElement('span');
  body.textContent = text;
  entry.append(title, body);
  get('messages').append(entry);
  scroll();
  return body;
}

function scroll() {
  const log = get('messages');
  log.scrollTop = log.scrollHeight;
}

get('settings-open').onclick = () => get('settings').showModal();
get('provider').onchange = () => {
  profiles[provider] = { key: get('text-key').value, model: get('text-model').value, url: get('text-url').value };
  provider = get('provider').value;
  const profile = profiles[provider];
  get('text-key').value = profile.key;
  get('text-model').value = profile.model;
  get('text-url').value = profile.url;
  get('url-row').hidden = provider !== 'custom';
  get('provider-pill').textContent = get('provider').selectedOptions[0].textContent;
};

get('composer').onsubmit = async event => {
  event.preventDefault();
  const content = get('prompt').value.trim();
  if (!content || busy || voice) return;
  if (!get('text-key').value.trim() || !get('text-model').value.trim()) {
    get('settings').showModal();
    return;
  }
  busy = true;
  get('send').disabled = get('voice').disabled = true;
  get('cancel').hidden = false;
  get('prompt').value = '';
  message('user', content);
  get('activity').textContent = 'Waiting for the model…';
  try {
    const turn = { role: 'user', content };
    const reply = await api.chat({
      provider, model: get('text-model').value.trim(), key: get('text-key').value.trim(),
      url: get('text-url').value.trim(), folder: selectedFolder(), automation: get('automation').checked,
    }, [...history.slice(-28), turn]);
    message('assistant', reply);
    history.push(turn, { role: 'assistant', content: reply });
  } catch (error) {
    message('assistant', error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
  } finally {
    busy = false;
    get('send').disabled = get('voice').disabled = false;
    get('cancel').hidden = true;
    get('activity').textContent = '';
    get('prompt').focus();
  }
};
get('cancel').onclick = () => api.stop();
api.onActivity(detail => { get('activity').textContent = detail; });

function clearPlayback(session) {
  for (const source of session.sources) source.stop();
  session.sources.clear();
  session.next = 0;
}

function stopVoice() {
  const session = voice;
  if (!session) return;
  voice = undefined;
  api.stop();
  session.stream?.getTracks().forEach(track => track.stop());
  clearPlayback(session);
  session.context?.close();
  get('mouth').style.transform = 'scaleY(.13)';
  get('voice').textContent = 'Start voice';
  get('state').textContent = 'Ready';
  get('send').disabled = false;
  get('activity').textContent = '';
}

function play(session, data, mimeType) {
  const raw = Uint8Array.from(atob(data), byte => byte.charCodeAt(0));
  const sampleCount = Math.floor(raw.byteLength / 2);
  if (!sampleCount) return;
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1]) || 24000;
  const buffer = session.context.createBuffer(1, sampleCount, rate);
  const view = new DataView(raw.buffer);
  const audio = buffer.getChannelData(0);
  for (let index = 0; index < audio.length; index++) audio[index] = view.getInt16(index * 2, true) / 32768;
  const source = session.context.createBufferSource();
  source.buffer = buffer;
  source.connect(session.analyser);
  session.sources.add(source);
  source.onended = () => session.sources.delete(source);
  const time = Math.max(session.next, session.context.currentTime + .025);
  source.start(time);
  session.next = time + buffer.duration;
}

function animate(session) {
  if (voice !== session) return;
  const waveform = session.waveform;
  session.analyser.getFloatTimeDomainData(waveform);
  const rms = Math.sqrt(waveform.reduce((sum, sample) => sum + sample * sample, 0) / waveform.length);
  session.level = session.level * .55 + Math.min(1, rms * 6) * .45;
  get('mouth').style.transform = `scaleY(${.13 + session.level * .87})`;
  if (session.ready) get('state').textContent = session.level > .07 ? 'Speaking' : 'Listening';
  requestAnimationFrame(() => animate(session));
}

get('voice').onclick = async () => {
  if (voice) return stopVoice();
  const key = get('voice-key').value.trim();
  const model = get('voice-model').value.trim();
  if (!key || !model) return get('settings').showModal();
  const session = { sources: new Set(), next: 0, level: 0 };
  voice = session;
  get('send').disabled = true;
  get('state').textContent = 'Connecting';
  get('voice').textContent = 'Stop voice';
  try {
    session.context = new AudioContext();
    await session.context.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (voice !== session) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    session.stream = stream;
    await session.context.audioWorklet.addModule('mic.js');
    if (voice !== session) return;
    const mic = new AudioWorkletNode(session.context, 'mithra-microphone');
    const mute = session.context.createGain();
    mute.gain.value = 0;
    const input = session.context.createMediaStreamSource(stream);
    input.connect(mic).connect(mute).connect(session.context.destination);
    mic.port.onmessage = ({ data }) => { if (voice === session && session.ready) api.audio(data); };
    session.analyser = session.context.createAnalyser();
    session.analyser.fftSize = 512;
    session.waveform = new Float32Array(session.analyser.fftSize);
    session.analyser.connect(session.context.destination);
    animate(session);
    await api.startVoice({ key, model, folder: selectedFolder(), automation: get('automation').checked });
  } catch (error) {
    if (voice !== session) return;
    stopVoice();
    message('assistant', error.message);
  }
};

api.onVoice(({ state, notice, content }) => {
  const session = voice;
  if (!session) return;
  if (state === 'Offline') stopVoice();
  if (state === 'Listening') session.ready = true;
  if (notice) get('activity').textContent = notice;
  if (!content) return;
  if (content.interrupted) clearPlayback(session);
  for (const part of content.modelTurn?.parts || []) {
    if (part.inlineData?.mimeType?.startsWith('audio/pcm') && !content.interrupted) {
      play(session, part.inlineData.data, part.inlineData.mimeType);
    }
  }
  for (const [type, role] of [['inputTranscription', 'user'], ['outputTranscription', 'assistant']]) {
    const transcript = content[type];
    if (transcript?.text) {
      session[type] ||= message(role, '');
      session[type].textContent += transcript.text;
      scroll();
    }
    if (transcript?.finished) session[type] = undefined;
  }
  if (content.turnComplete || content.interrupted) {
    session.inputTranscription = undefined;
    session.outputTranscription = undefined;
    get('activity').textContent = '';
  }
});

message('assistant', 'ආයුබෝවන්! අද මම ඔබට කොහොමද උදව් කරන්නේ?');
