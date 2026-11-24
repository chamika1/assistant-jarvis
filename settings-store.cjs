const { mkdir, readFile, rename, rm, writeFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

function createSettingsStore({ directory, encryption, platform }) {
  const file = path.join(directory, 'provider-settings.bin');
  let lastWrite = Promise.resolve();

  function available() {
    return encryption.isEncryptionAvailable() &&
      (platform !== 'linux' || !['basic_text', 'unknown'].includes(encryption.getSelectedStorageBackend()));
  }

  async function load() {
    if (!available()) return { available: false };
    await lastWrite;
    try {
      const bytes = await readFile(file);
      return { available: true, settings: JSON.parse(encryption.decryptString(bytes)) };
    } catch (error) {
      return { available: true, ...(error.code === 'ENOENT' ? {} : { unreadable: true }) };
    }
  }

  function save(settings) {
    if (!available()) return Promise.resolve({ available: false });
    const bytes = encryption.encryptString(JSON.stringify(settings));
    const operation = lastWrite.then(async () => {
      await mkdir(directory, { recursive: true });
      const temporary = file + '.' + randomUUID();
      try {
        await writeFile(temporary, bytes, { mode: 0o600 });
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
      return { available: true };
    });
    lastWrite = operation.catch(() => {});
    return operation;
  }

  return { load, save };
}

module.exports = { createSettingsStore };
