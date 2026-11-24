const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mithra', {
  chat: (settings, history) => ipcRenderer.invoke('chat', settings, history),
  startVoice: settings => ipcRenderer.invoke('live-start', settings),
  stop: () => ipcRenderer.send('stop'),
  audio: samples => ipcRenderer.send('pcm', samples),
  onVoice: fn => ipcRenderer.on('voice', (_event, data) => fn(data)),
  onActivity: fn => ipcRenderer.on('activity', (_event, data) => fn(data)),
});
