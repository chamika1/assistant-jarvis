const get = id => document.getElementById(id);
const api = window.mithra;
const tasks = new Map();
let selectedTask;
const profiles = {
  hermes: { key: '', model: '', url: 'http://127.0.0.1:8642/v1' },
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
const voiceTask = makeTask('voice', 'Voice transcript');
const stateLabel = { ready: 'Ready', running: 'Running', done: 'Done', failed: 'Failed', stopped: 'Stopped', paused: 'Needs you' };

function makeTask(id = crypto.randomUUID(), title = 'New task') {
  const log = document.createElement('div');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  const task = { id, title, log, history: [], state: 'ready', detail: '', draft: '', events: [] };
  tasks.set(id, task);
  return task;
}

function selectTask(task) {
  if (selectedTask && selectedTask !== voiceTask) {
    selectedTask.draft = get('prompt').value;
    selectedTask.clarification = get('hermes-answer').value;
  }
  selectedTask = task;
  get('prompt').value = task.draft;
  get('hermes-answer').value = task.clarification || '';
  get('messages').replaceChildren(task.log);
  renderTasks();
  renderTaskEvents();
  get('task-list').querySelector('[aria-pressed=true]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  scroll();
}

const historyKey = 'mithra.textTasks';
get('save-history').checked = localStorage.getItem(historyKey) !== null;
get('save-history').onchange = saveHistory;

function saveHistory() {
  try {
    if (!get('save-history').checked) {
      localStorage.removeItem(historyKey);
      return;
    }
    const entries = [...tasks.values()].filter(task => task !== voiceTask && task.history.length).slice(-20)
      .map(({ id, title, history }) => ({ id, title, history: history.slice(-24) }));
    localStorage.setItem(historyKey, JSON.stringify(entries));
  } catch {
    if (selectedTask) selectedTask.detail = 'Could not save task history on this device.';
  }
}

function restoreHistory() {
  try {
    const entries = JSON.parse(localStorage.getItem(historyKey) || '[]');
    for (const { id, title, history } of entries) {
      const task = makeTask(id, title);
      task.history = history;
      task.state = 'done';
      for (const turn of history) message(turn.role, turn.content, task);
    }
  } catch {
    return;
  }
}

function renderTasks() {
  const list = get('task-list');
  list.replaceChildren();
  for (const task of tasks.values()) {
    if (task === voiceTask) continue;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'task-tab';
    tab.setAttribute('aria-pressed', String(task === selectedTask));
    tab.title = task.title;
    const name = document.createElement('span');
    name.textContent = task.title;
    const state = document.createElement('small');
    state.dataset.state = task.state;
    state.textContent = stateLabel[task.state];
    tab.append(name, state);
    tab.onclick = () => selectTask(task);
    list.append(tab);
  }
  const task = selectedTask;
  get('task-title').textContent = task.title;
  get('voice-task').setAttribute('aria-pressed', String(task === voiceTask));
  get('reuse-task').hidden = task === voiceTask || !task.history.length;
  get('close-task').hidden = task === voiceTask || task.state === 'running';
  get('composer').hidden = task === voiceTask;
  get('send').disabled = task.state === 'running';
  get('prompt').disabled = task.state === 'running';
  get('running-hint').hidden = task.state !== 'running';
  get('cancel').hidden = task.state !== 'running';
  get('activity').textContent = task.detail;
  renderHermesControl();
}

function newTask() {
  selectTask(makeTask());
  get('prompt').focus();
}
get('new-task').onclick = newTask;
get('parallel-task').onclick = newTask;
get('voice-task').onclick = () => selectTask(voiceTask);
get('reuse-task').onclick = () => {
  const prompt = selectedTask.history.find(turn => turn.role === 'user')?.content;
  if (!prompt) return;
  selectTask(makeTask());
  get('prompt').value = prompt;
  get('prompt').focus();
};
get('close-task').onclick = () => {
  const task = selectedTask;
  if (task === voiceTask || task.state === 'running') return;
  api.closeTask(task.id);
  tasks.delete(task.id);
  saveHistory();
  selectTask([...tasks.values()].find(item => item !== voiceTask) || makeTask());
};

function message(role, text, task = selectedTask) {
  const entry = document.createElement('div');
  entry.className = 'message ' + role;
  const title = document.createElement('strong');
  title.textContent = role === 'user' ? 'You' : 'Mithra';
  const body = document.createElement('span');
  body.textContent = text;
  entry.append(title, body);
  task.log.append(entry);
  if (task === selectedTask) scroll();
  return body;
}

function renderTaskEvents() {
  const panel = get('task-events');
  const list = get('task-event-list');
  panel.hidden = !selectedTask.events.length;
  list.replaceChildren(...selectedTask.events.map(entry => {
    const row = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = entry.label;
    row.append(label);
    if (entry.detail) {
      const detail = document.createElement('span');
      detail.textContent = entry.detail;
      row.append(detail);
    }
    return row;
  }));
  list.scrollTop = list.scrollHeight;
}

api.onTaskEvent(({ taskId, entry }) => {
  const task = tasks.get(taskId);
  if (!task) return;
  task.events.push(entry);
  if (task.events.length > 50) task.events.shift();
  if (selectedTask === task) renderTaskEvents();
});

function scroll() {
  const log = get('messages');
  log.scrollTop = log.scrollHeight;
}

const memoryKey = 'mithra.longTermMemory';
let savedMemory = { text: '', enabled: false };
try {
  savedMemory = JSON.parse(localStorage.getItem(memoryKey) || 'null') || savedMemory;
} catch {
  // Keep the defaults if this preference cannot be read.
}

function memoryContext() {
  return savedMemory.enabled ? savedMemory.text : undefined;
}

function rememberProfile() {
  profiles[provider] = {
    key: get('text-key').value.trim(), model: get('text-model').value.trim(), url: get('text-url').value.trim(),
  };
}

function renderHermesControl() {
  const prompt = selectedTask?.hermesPrompt;
  get('hermes-control').hidden = !prompt;
  if (!prompt) return;
  const approval = prompt.kind === 'approval';
  const explanation = approval ? [prompt.description, prompt.command].filter(Boolean).join('\n') : prompt.question;
  const options = !approval && Array.isArray(prompt.choices) && prompt.choices.length
    ? '\n' + prompt.choices.join(' · ') : '';
  get('hermes-prompt').textContent = String(explanation || 'Hermes needs your input.').slice(0, 3000) + options.slice(0, 800);
  get('hermes-answer').hidden = approval;
  get('hermes-allow').textContent = approval ? 'Allow once' : 'Send answer';
  get('hermes-deny').textContent = approval ? 'Deny' : 'Skip';
}

function answerHermes(allow) {
  const task = selectedTask;
  const prompt = task?.hermesPrompt;
  if (!prompt) return;
  const value = prompt.kind === 'approval' ? (allow ? 'once' : 'deny') :
    (allow ? get('hermes-answer').value.trim() : '');
  api.answerHermes({ taskId: task.id, promptId: prompt.prompt_id, generation: prompt.execution_generation, value });
  task.hermesPrompt = null;
  get('hermes-answer').value = '';
  renderHermesControl();
}

api.onHermesControl(({ taskId, prompt }) => {
  const task = tasks.get(taskId);
  if (!task) return;
  task.hermesPrompt = prompt;
  if (selectedTask === task) {
    get('hermes-answer').value = '';
    renderHermesControl();
  }
});
get('hermes-allow').onclick = () => answerHermes(true);
get('hermes-deny').onclick = () => answerHermes(false);
get('hermes-test').onclick = async () => {
  const button = get('hermes-test');
  const status = get('hermes-status');
  button.disabled = true;
  status.textContent = 'Checking the local gateway…';
  try {
    const result = await api.inspectHermes({ url: get('text-url').value.trim(), key: get('text-key').value.trim() });
    const skills = result.skills ? `${result.skills.length} skills listed.` : 'Skill catalogue unavailable.';
    const tools = result.toolsets ? (result.toolsets.join(', ') || 'none') : 'unavailable';
    status.textContent = `Connected. ${skills} Active toolsets: ${tools}.`;
  } catch (error) {
    status.textContent = error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  } finally { button.disabled = false; }
};

function showProvider(value) {
  provider = Object.hasOwn(profiles, value) ? value : 'openai';
  get('provider').value = provider;
  const profile = profiles[provider];
  get('text-key').value = profile.key;
  get('text-model').value = profile.model;
  get('text-url').value = profile.url;
  get('url-row').hidden = !['custom', 'hermes'].includes(provider);
  get('model-row').hidden = provider === 'hermes';
  get('hermes-settings').hidden = provider !== 'hermes';
  get('hermes-status').textContent = '';
  get('provider-pill').textContent = get('provider').selectedOptions[0].textContent;
}

const sessionSettingsMessage = 'Secure storage is unavailable. API keys will last for this session only.';
const settingsReady = api.loadSettings().then(result => {
  if (!result?.available) {
    get('settings-status').textContent = sessionSettingsMessage;
    return;
  }
  if (result.unreadable) {
    get('settings-status').textContent = 'Saved keys could not be opened. Enter them again and save.';
    return;
  }
  const settings = result.settings;
  if (!settings) return;
  for (const name of Object.keys(profiles)) {
    if (settings.profiles?.[name]) profiles[name] = settings.profiles[name];
  }
  showProvider(settings.provider);
  get('voice-key').value = settings.voice?.key || '';
  if (settings.voice?.model) get('voice-model').value = settings.voice.model;
  get('voice-name').value = settings.voice?.name || '';
}).catch(() => {
  get('settings-status').textContent = 'Could not load saved API settings.';
});

get('settings-open').onclick = async () => {
  await settingsReady;
  if (get('settings').open) return;
  get('memory').value = savedMemory.text;
  get('use-memory').checked = savedMemory.enabled;
  get('settings').showModal();
};
const updateLabel = {
  idle: 'Check for updates', current: 'Check again', error: 'Check again',
  available: 'Download update', ready: 'Restart and install',
};
const updateAction = {
  idle: api.checkUpdate, current: api.checkUpdate, error: api.checkUpdate,
  available: api.downloadUpdate, ready: api.installUpdate,
};
let updateState;
function showUpdate(update) {
  if (!update) return;
  updateState = update;
  const text = {
    idle: 'Ready to check for updates.',
    unsupported: 'In-app updates are available in the Windows build.',
    checking: 'Checking for updates…',
    current: 'You have the latest version.',
    available: `Version ${update.next} is available.`,
    downloading: `Downloading version ${update.next}… ${update.progress}%`,
    ready: `Version ${update.next} is ready to install.`,
    installing: 'Restarting to install the update…',
  };
  get('update-status').textContent = `Version ${update.version}. ${update.message || text[update.phase] || ''}`;
  const button = get('update-action');
  button.hidden = !updateLabel[update.phase];
  button.textContent = updateLabel[update.phase] || '';
  const notice = get('update-notice');
  notice.hidden = !['available', 'downloading', 'ready'].includes(update.phase);
  notice.textContent = update.phase === 'ready' ? 'Update ready' : update.phase === 'downloading' ? 'Downloading update…' : 'Update available';
}
api.onUpdate(showUpdate);
api.updateState().then(status => { if (!updateState) showUpdate(status); });
get('update-notice').onclick = () => {
  get('settings-open').click();
  settingsReady.then(() => get('updates').scrollIntoView({ block: 'nearest' }));
};
get('update-action').onclick = async () => {
  const action = updateAction[updateState?.phase];
  if (action) showUpdate(await action());
};

get('provider').onchange = () => {
  rememberProfile();
  showProvider(get('provider').value);
};
get('settings-close').onclick = () => {
  if (!get('settings-save').disabled) get('settings').close();
};
get('settings-form').onsubmit = async event => {
  event.preventDefault();
  const button = get('settings-save');
  button.disabled = true;
  rememberProfile();
  try {
    const memory = { text: get('memory').value.trim(), enabled: get('use-memory').checked };
    localStorage.setItem(memoryKey, JSON.stringify(memory));
    savedMemory = memory;
    const result = await api.saveSettings({
      provider, profiles, voice: {
        key: get('voice-key').value.trim(), model: get('voice-model').value.trim(), name: get('voice-name').value.trim(),
      },
    });
    get('settings-status').textContent = result?.available ? 'API settings saved using secure storage.' : sessionSettingsMessage;
    if (result?.available) get('settings').close();
  } catch {
    get('settings-status').textContent = 'Could not save settings. Your API keys remain available for this session.';
  } finally {
    button.disabled = false;
  }
};
get('settings').addEventListener('cancel', event => {
  if (get('settings-save').disabled) event.preventDefault();
});

get('composer').onsubmit = async event => {
  event.preventDefault();
  const content = get('prompt').value.trim();
  if (content && await submitTask(selectedTask, content)) get('prompt').focus();
};

function textSettings() {
  return {
    provider, model: get('text-model').value.trim(), key: get('text-key').value.trim(),
    url: get('text-url').value.trim(), memory: memoryContext(),
  };
}

async function submitTask(task, content, background = false, config) {
  await settingsReady;
  config ??= textSettings();
  if (!content || task === voiceTask || task.state === 'running') return;
  if (!config.key || (config.provider !== 'hermes' && !config.model)) {
    if (!background && !get('settings').open) get('settings-open').click();
    if (background) { task.state = 'failed'; task.detail = 'Configure the text provider in Settings.'; renderTasks(); }
    return;
  }
  const engine = config.provider;
  if (!task.history.length) task.title = content.slice(0, 70);
  task.state = 'running';
  task.detail = engine === 'hermes' ? 'Waiting for the Hermes gateway…' : 'Waiting for the model…';
  task.stopping = false;
  if (!background) {
    task.draft = '';
    if (selectedTask === task) get('prompt').value = '';
  }
  message('user', content, task);
  renderTasks();
  try {
    const turn = { role: 'user', content };
    const reply = await api.chat({
      ...config, folder: background ? undefined : selectedFolder(),
      automation: !background && get('automation').checked,
    }, [...task.history.slice(-28), turn], task.id);
    message('assistant', reply.text, task);
    task.history.push(turn, { role: 'assistant', content: reply.text });
    task.state = reply.stopped ? 'stopped' : reply.paused ? 'paused' : 'done';
    task.detail = reply.paused ? 'Complete verification in this task’s browser, then type “continue”.' : '';
  } catch (error) {
    task.state = task.stopping && engine !== 'hermes' ? 'stopped' : 'failed';
    message('assistant', task.stopping && engine !== 'hermes' ? 'Task stopped.' :
      error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''), task);
    task.detail = '';
  } finally {
    saveHistory();
    renderTasks();
  }
  return task === selectedTask;
}

api.onDelegate(({ taskId, request }) => {
  if (!voice) return;
  const task = makeTask(taskId);
  submitTask(task, request, true, voice.textConfig);
});
get('cancel').onclick = () => {
  selectedTask.stopping = true;
  api.stopTask(selectedTask.id);
};
api.onActivity(update => {
  const task = typeof update === 'string' ? voiceTask : tasks.get(update.taskId);
  if (!task) return;
  task.detail = typeof update === 'string' ? update : update.detail;
  if (task === selectedTask) get('activity').textContent = task.detail;
});

function clearPlayback(session) {
  for (const source of session.sources) source.stop();
  session.sources.clear();
  session.next = 0;
}

function stopVoice() {
  const session = voice;
  if (!session) return;
  voice = undefined;
  api.stopVoice();
  session.stream?.getTracks().forEach(track => track.stop());
  clearPlayback(session);
  session.context?.close();
  get('mouth').style.transform = 'scaleY(.13)';
  window.mithraAvatar?.(0);
  get('voice').textContent = 'Start voice';
  get('state').textContent = 'Ready';
  voiceTask.detail = '';
  renderTasks();
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
  window.mithraAvatar?.(session.level);
  if (session.ready) get('state').textContent = session.level > .07 ? 'Speaking' : 'Listening';
  requestAnimationFrame(() => animate(session));
}

get('voice').onclick = async () => {
  if (voice) return stopVoice();
  await settingsReady;
  if (voice) return;
  const key = get('voice-key').value.trim();
  const model = get('voice-model').value.trim();
  if (!key || !model) return get('settings-open').click();
  const session = { sources: new Set(), next: 0, level: 0, textConfig: textSettings() };
  voice = session;
  selectTask(voiceTask);
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
    await api.startVoice({
      key, model, voiceName: get('voice-name').value.trim(), folder: selectedFolder(), automation: get('automation').checked,
      memory: memoryContext(),
      background: Boolean(session.textConfig.key && (session.textConfig.provider === 'hermes' || session.textConfig.model)),
      backgroundEngine: session.textConfig.provider,
    });
  } catch (error) {
    if (voice !== session) return;
    stopVoice();
    message('assistant', error.message, voiceTask);
  }
};

api.onVoice(({ state, notice, content }) => {
  const session = voice;
  if (!session) return;
  if (state === 'Offline') stopVoice();
  if (state === 'Listening') session.ready = true;
  if (state === 'Reconnecting') {
    session.ready = false;
    clearPlayback(session);
    get('state').textContent = state;
  }
  if (notice !== undefined) { voiceTask.detail = notice; renderTasks(); }
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
      session[type] ||= message(role, '', voiceTask);
      session[type].textContent += transcript.text;
      if (voiceTask === selectedTask) scroll();
    }
    if (transcript?.finished) {
      const phrase = session[type]?.textContent.trim().replace(/[.!?।]+$/, '').toLowerCase();
      if (role === 'user' && ['mithra stop listening', 'stop listening', 'මිත්‍රා නවත්වන්න'].includes(phrase)) {
        stopVoice();
        return;
      }
      session[type] = undefined;
    }
  }
  if (content.turnComplete || content.interrupted) {
    session.inputTranscription = undefined;
    session.outputTranscription = undefined;
    if (selectedTask === voiceTask) get('activity').textContent = voiceTask.detail;
  }
});

api.onVoiceToggle(() => get('voice').click());
get('voice-shortcut').textContent = navigator.platform.startsWith('Mac') ? '· ⌘ Shift Space' : '· Ctrl Shift Space';
restoreHistory();
selectTask(makeTask());
message('assistant', 'ආයුබෝවන්! අද මම ඔබට කොහොමද උදව් කරන්නේ?');
