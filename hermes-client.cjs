const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

function createHermesClient({ url, key, request = fetch }) {
  const base = new URL(url || 'http://127.0.0.1:8642/v1');
  if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname) ||
      base.username || base.password || base.search || base.hash || !/^\/v1\/?$/.test(base.pathname)) {
    throw new Error('Enter a local Hermes gateway URL ending in /v1, such as http://127.0.0.1:8642/v1.');
  }
  if (typeof key !== 'string' || !key.trim()) throw new Error('Enter the Hermes API server key in Settings.');
  const endpoint = base.href.replace(/\/$/, '');

  async function call(route, { body, headers = {}, signal, timeout = 12000 } = {}) {
    const deadline = AbortSignal.timeout(timeout);
    let response;
    try {
      response = await request(endpoint + route, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error',
        signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      });
    } catch (error) {
      signal?.throwIfAborted();
      if (error.name === 'TimeoutError' || error instanceof TypeError) {
        throw new Error('Could not reach the local Hermes gateway. Confirm it is running and check the address.');
      }
      throw error;
    }
    if (response.status === 401 || response.status === 403) throw new Error('Hermes rejected the API server key or account permissions.');
    if (response.status === 404 && route === '/runs') throw new Error('This Hermes gateway lacks the Runs API. Update Hermes and restart the gateway.');
    if (!response.ok) throw new Error(`Hermes returned HTTP ${response.status}.`);
    return response.json();
  }

  async function inspect() {
    const capabilities = await call('/capabilities');
    if (!capabilities?.endpoints?.runs) throw new Error('This Hermes gateway lacks the Runs API. Update Hermes and restart the gateway.');
    const [skills, toolsets] = await Promise.allSettled([call('/skills'), call('/toolsets')]);
    return {
      connected: true,
      skills: skills.status === 'fulfilled' && Array.isArray(skills.value?.data ?? skills.value)
        ? (skills.value.data ?? skills.value).map(item => item.name).filter(Boolean) : null,
      toolsets: toolsets.status === 'fulfilled' && Array.isArray(toolsets.value?.data ?? toolsets.value)
        ? (toolsets.value.data ?? toolsets.value).filter(item => item.enabled).map(item => item.name) : null,
    };
  }

  async function streamActivity(route, signal, notify) {
    const response = await request(endpoint + route + '/events', {
      headers: { Authorization: 'Bearer ' + key, Accept: 'text/event-stream' },
      redirect: 'error', signal,
    });
    if (!response.ok || !response.body) throw new Error('Activity stream unavailable');
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const lines = frame.split(/\r?\n/);
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        let event;
        try { event = JSON.parse(data); } catch { continue; }
        const kind = event.event || lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const tool = typeof event.tool === 'string' ? event.tool.slice(0, 100) : 'Tool';
        const preview = typeof event.preview === 'string' ? event.preview.slice(0, 500) : '';
        if (kind === 'tool.started') notify({ label: 'Running ' + tool, detail: preview });
        if (kind === 'tool.completed') notify({ label: tool + (event.error ? ' failed' : ' finished'), detail: preview });
        if (kind === 'subagent.start') notify({ label: 'Subagent started' });
        if (kind === 'subagent.complete') notify({ label: 'Subagent finished', detail: String(event.status || '').slice(0, 100) });
        if (kind === 'message.interim' && typeof event.text === 'string') notify({ label: 'Hermes update', detail: event.text.slice(0, 600) });
      }
      if (buffer.length > 262144) throw new Error('Activity frame too large');
    }
  }

  async function run({ sessionId, input, instructions, signal, onStatus, onControl, onActivity }) {
    signal.throwIfAborted();
    const headers = { 'Idempotency-Key': randomUUID() };
    // Admission uses its own deadline so Stop can still reach the admitted run.
    const admitted = await call('/runs', { body: { input, session_id: sessionId, instructions }, headers });
    if (!/^run_[a-zA-Z0-9_-]+$/.test(admitted?.run_id || '')) throw new Error('Hermes returned an invalid run ID.');
    const route = '/runs/' + admitted.run_id;
    const stream = new AbortController();
    if (onActivity) {
      streamActivity(route, stream.signal, onActivity).catch(() => {
        if (!stream.signal.aborted) onActivity({ label: 'Live activity unavailable', detail: 'Task status will still update.' });
      });
    }
    try {
      const answered = new Set();
      let stopRequested = false;
      let deadline = Infinity;
      while (true) {
        if (signal.aborted && !stopRequested) {
          stopRequested = true;
          deadline = Date.now() + 20000;
          onStatus('Stopping Hermes…');
          try { await call(route + '/stop', { body: {}, timeout: 5000 }); }
          catch { throw new Error('Could not confirm that Hermes received the stop request. Check the gateway.'); }
        }
        const status = await call(route, { timeout: 8000 });
        if (status.status === 'completed') return { text: status.output || 'Hermes completed the run.' };
        if (status.status === 'cancelled') return { stopped: true, text: 'Hermes stopped the run.' };
        if (['failed', 'interrupted', 'unknown'].includes(status.status)) {
          throw new Error(typeof status.error === 'string' ? status.error.slice(0, 1000) :
            `Hermes run ${status.status}. Check the gateway for details.`);
        }
        if (Date.now() >= deadline) throw new Error('Hermes received the stop request and is still stopping. Check the gateway before retrying.');
        if (!signal.aborted) {
          onStatus(status.status === 'queued' ? 'Hermes · queued' : 'Hermes · working');
          for (const prompt of status.pending_controls || []) {
            if (!['approval', 'clarify'].includes(prompt.kind) || typeof prompt.prompt_id !== 'string' ||
                !Number.isSafeInteger(prompt.execution_generation ?? status.execution_generation)) continue;
            const execution_generation = prompt.execution_generation ?? status.execution_generation;
            const answerKey = `${execution_generation}:${prompt.prompt_id}`;
            if (answered.has(answerKey)) continue;
            const value = await onControl({ ...prompt, execution_generation }, signal);
            if (signal.aborted) break;
            if (value == null) {
              answered.add(answerKey);
              continue;
            }
            const field = prompt.kind === 'approval' ? 'choice' : 'answer';
            await call(route + (prompt.kind === 'approval' ? '/approval' : '/clarify'), {
              body: { request_id: prompt.prompt_id, execution_generation, [field]: value },
            });
            answered.add(answerKey);
          }
        }
        if (!signal.aborted || stopRequested) await delay(stopRequested ? 500 : 850);
      }
    } finally { stream.abort(); }
  }

  async function vision({ sessionId, content, signal }) {
    const result = await call('/chat/completions', {
      body: { messages: [{ role: 'user', content }] },
      headers: { 'X-Hermes-Session-Id': sessionId },
      timeout: 120000, signal,
    });
    const text = result?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text) throw new Error('Hermes returned no image analysis. Check the configured vision model.');
    return { text };
  }

  return { inspect, run, vision };
}

module.exports = { createHermesClient };
