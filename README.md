# Mithra Desktop

A Sinhala-first personal desktop assistant. The Electron interface includes an animated robot face, a live transcript, text chat, and a visible browser controlled by model tool calls.

## Run from source

Install Node.js 22 or newer and Git. On Windows, run the commands from PowerShell. On macOS or Linux, use a terminal in a graphical desktop session.

```sh
npm ci
npx playwright install chromium
npm start
```

On Linux, Chromium may also require system libraries. Playwright documents those dependencies and the `install --with-deps chromium` command.

## Configure

Open **Settings**. For voice, enter your Gemini API key and the Gemini Live model ID enabled for your account. The app defaults to `gemini-3.1-flash-live-preview`. Choose **Start voice** and try saying **ආයුබෝවන්, සිංහලෙන් කතා කරමු**. The robot's mouth follows the amplitude of the audio being played. Model choice and microphone quality affect the voice experience.

For text, select OpenAI, DeepSeek, or a custom OpenAI-compatible provider, then enter that provider's key and model ID. Custom providers need an HTTPS base URL that serves `/chat/completions`. For browser tasks, select a model that supports function calling with that provider.

The voice model and text model are independent. Use **Save & close** to persist provider profiles and API keys in your operating system’s encrypted storage. On Linux, a compatible keyring must be available to retain the keys after exit. The selected text service receives text chat history, while Gemini receives audio during live sessions. When browser actions are enabled, the active model also receives a limited view of page headings and controls.

## Browser workflows

1. Enable **Browser actions** before sending a message or starting voice.
2. Ask Mithra to open the target website and explain the task. Example: “Open https://example.com and tell me what controls you find.”
3. For a signup, provide the site and the ordinary field values you want used. Mithra can open a separate Chromium window, inspect visible labels, fill fields, and propose clicks across multiple steps.
4. Routine same-site navigation and playback proceed directly. Review consequential or ambiguous clicks in Mithra. Enter passwords and verification codes directly in Chromium and complete any CAPTCHA yourself. After manual interaction, ask Mithra to continue. The browser session stays open while the app runs.

This starter covers visible HTTPS browser workflows. It currently supports accessible labels, placeholder text, tabs, visible media tiles and embedded video controls. The assistant checks whether video time advances before reporting playback. Sites with playback errors or unavailable controls can still require manual interaction. Native desktop app control, background scheduling, and persistent browser profiles are outside this release.

## Development

```sh
npm run check
```

[Gemini Live API documentation](https://aistudio.google.com/docs/live-api) · [Playwright browser setup](https://playwright.dev/docs/browsers)

## Project commands

Choose a trusted local project folder and enable **Project commands**. In chat or voice, ask Mithra to check Git status, summarize the Git diff, or run the project's `test`, `build`, or `lint` script. Git and Node must be on your PATH. Mithra shows the command and working directory for approval. Selected scripts run with your local account permissions. A bounded excerpt of the command output goes to the active model.

If Mithra detects a common CAPTCHA or human-verification page, complete the challenge in Chromium and ask Mithra to continue. Detection depends on the verification widget and page.

## Desktop packages

On Windows x64, download and run the setup EXE from GitHub Releases. Portable Windows and Linux x64 zip packages are also available. For portable Windows, extract the zip and open **Mithra Desktop.exe**. On Linux, launch **mithra-desktop** from the extracted folder. These builds are unsigned. Browser actions use an installed Google Chrome or Microsoft Edge, or Playwright Chromium if installed. The project CLI tools still use Git and Node from your PATH.

Build the packages yourself with `npm run dist:win` or `npm run dist:linux`.

## Voice and concurrent tasks

- Start Gemini Live with the **Start voice** button or **Ctrl+Shift+Space** (**⌘+Shift+Space** on macOS), then speak naturally. Gemini Live reconnects on eligible disconnects when a resumption token is available. Keep the app open while listening. Say “Mithra stop listening” or “මිත්‍රා නවත්වන්න” to end the session.
- Use **New task** to work on up to four independent text tasks at a time. Their tabs show progress. Each browser-enabled task has its own temporary browsing context. Closing the task clears its browser context.
- With a text provider configured, tell Gemini Live to delegate something in the background, for example “මිත්‍රා, මේ මාතෘකාව ගැන කෙටි වාර්තාවක් background task එකක් විදිහට ලියන්න.” The text model handles that request while Gemini keeps listening. Ask “What tasks are running?” to check progress. Delegated text tasks use no browser or project tools.
- Enable **Keep text task history on this device** in Settings to reopen text conversations later. **Reuse prompt** lets you start a fresh task with a previous request. History is local and unencrypted, and browser sessions are temporary.
- Browser clicks and project commands still need approval in the app. CAPTCHA, password and verification-code steps are completed directly in the browser.

[Hermes Agent](https://github.com/NousResearch/hermes-agent) and [Muse Agent](https://github.com/raghavkhandal72-coder/muse-agent) informed the parallel-task and local workspace design. Mithra uses its own Electron interface, Gemini Live connection, and tool implementation.

## Long-term memory

Add personal preferences, active projects or recurring instructions under **Settings → Long-term memory**. Saving keeps the notes on this device across restarts. If you enable **Include memory in new AI requests**, Mithra provides those notes to the selected text model and new Gemini Live sessions. This is editable context. Conversation history is a separate opt-in feature. API keys use the operating system’s encrypted storage and are kept outside memory and history.

## In-app updates on Windows

Install version 0.2.2 or newer from GitHub Releases. Mithra checks the public GitHub Releases feed on startup. You can also open **Settings → App updates → Check for updates**. If an update is available, choose **Download update** and then **Restart and install** when ready. Finish running tasks and stop Gemini Live first.

The Windows release workflow uploads the installer, update manifest and blockmap to the same draft. Publish the draft after all packages have uploaded. The updater verifies the downloaded installer's checksum against that release manifest. The installer is unsigned. Linux ZIP users install new versions from GitHub Releases.
