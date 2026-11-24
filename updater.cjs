function createUpdater({ engine, version, notify, canInstall }) {
  let state = { version, phase: engine ? 'idle' : 'unsupported' };
  const update = (phase, extra = {}) => {
    state = { version, phase, ...extra };
    notify(state);
  };

  if (engine) {
    engine.autoDownload = false;
    engine.autoInstallOnAppQuit = false;
    engine.allowPrerelease = false;
    engine.allowDowngrade = false;
    engine.on('update-available', info => update('available', { next: info.version }));
    engine.on('update-not-available', () => update('current'));
    engine.on('download-progress', progress => {
      if (state.phase === 'downloading') update('downloading', { next: state.next, progress: Math.round(progress.percent) });
    });
    engine.on('update-downloaded', info => update('ready', { next: info.version }));
    engine.on('error', () => {
      if (state.phase === 'installing') {
        update('ready', { next: state.next, message: 'Could not start the installer. Try again.' });
      } else if (state.phase === 'checking' || state.phase === 'downloading') {
        update('error', { message: state.phase === 'checking' ? 'Could not check for updates.' : 'Could not download the update.' });
      }
    });
  }

  async function check() {
    if (!engine || !['idle', 'current', 'error'].includes(state.phase)) return state;
    update('checking');
    try {
      await engine.checkForUpdates();
      if (state.phase === 'checking') update('current');
    } catch {
      if (state.phase === 'checking') update('error', { message: 'Could not check for updates.' });
    }
    return state;
  }

  async function download() {
    if (!engine || state.phase !== 'available') return state;
    update('downloading', { next: state.next, progress: 0 });
    try {
      await engine.downloadUpdate();
    } catch {
      if (state.phase === 'downloading') update('error', { message: 'Could not download the update.' });
    }
    return state;
  }

  function install() {
    if (!engine || state.phase !== 'ready') return state;
    const next = state.next;
    if (!canInstall()) {
      update('ready', { next, message: 'Finish active tasks and stop voice before restarting.' });
      return state;
    }
    update('installing', { next });
    try {
      engine.quitAndInstall(false, true);
    } catch {
      update('ready', { next, message: 'Could not start the installer. Try again.' });
    }
    return state;
  }

  return { state: () => state, check, download, install };
}

module.exports = { createUpdater };
