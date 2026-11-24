const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mithra', {
  loadSettings: () => ipcRenderer.invoke('settings-load'),
  saveSettings: settings => ipcRenderer.invoke('settings-save', settings),
  pickFolder: () => ipcRenderer.invoke('project-folder'),
  chat: (settings, history, taskId) => ipcRenderer.invoke('chat', settings, history, taskId),
  startVoice: settings => ipcRenderer.invoke('live-start', settings),
  stopVoice: () => ipcRenderer.send('stop-voice'),
  stopTask: id => ipcRenderer.send('stop-task', id),
  closeTask: id => ipcRenderer.send('close-task', id),
  onDelegate: fn => ipcRenderer.on('delegate-task', (_event, request) => fn(request)),
  onVoiceToggle: fn => ipcRenderer.on('voice-toggle', () => fn()),
  audio: samples => ipcRenderer.send('pcm', samples),
  onVoice: fn => ipcRenderer.on('voice', (_event, data) => fn(data)),
  onActivity: fn => ipcRenderer.on('activity', (_event, data) => fn(data)),
});
