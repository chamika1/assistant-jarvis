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

The voice model and text model are independent. API keys are kept in memory for the current session. The selected text service receives text chat history, while Gemini receives audio during live sessions. When browser actions are enabled, the active model also receives a limited view of page headings and controls.

## Browser workflows

1. Enable **Browser actions** before sending a message or starting voice.
2. Ask Mithra to open the target website and explain the task. Example: “Open https://example.com and tell me what controls you find.”
3. For a signup, provide the site and the ordinary field values you want used. Mithra can open a separate Chromium window, inspect visible labels, fill fields, and propose clicks across multiple steps.
4. Review proposed clicks in Mithra. Enter passwords and verification codes directly in Chromium and complete any CAPTCHA yourself. After manual interaction, ask Mithra to continue. The browser session stays open while the app runs.

This starter covers visible HTTPS browser workflows. It currently supports exact accessible labels and names, so sites with unavailable or ambiguous labels can require manual interaction. Native desktop app control, background scheduling, persistent browser profiles, and installers are outside this first build.

## Development

```sh
npm run check
```

[Gemini Live API documentation](https://aistudio.google.com/docs/live-api) · [Playwright browser setup](https://playwright.dev/docs/browsers)

## Project commands

Choose a trusted local project folder and enable **Project commands**. In chat or voice, ask Mithra to check Git status, summarize the Git diff, or run the project's `test`, `build`, or `lint` script. Git and Node must be on your PATH. Mithra shows the command and working directory for approval. Selected scripts run with your local account permissions. A bounded excerpt of the command output goes to the active model.

If Mithra detects a common CAPTCHA or human-verification page, complete the challenge in Chromium and ask Mithra to continue. Detection depends on the verification widget and page.
