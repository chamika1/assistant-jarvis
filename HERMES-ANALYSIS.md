# Hermes Agent and Mithra Desktop

Reviewed the upstream MIT-licensed repository at [24b14819](https://github.com/NousResearch/hermes-agent/tree/24b148198e4c1ff8b49b9b18863d093ea20b9586), including its feature guide, HTTP contract, Runs implementation and generation-bound controls. Mithra invokes the upstream engine through that API.

| Area | Upstream architecture | Mithra 0.3 |
| --- | --- | --- |
| Agent execution | Persistent gateway sessions, agent-managed tool loop, native run lifecycle | Native Runs API, separate session ID per task, up to four active tasks in the dashboard |
| Run control | Approval, clarification, stop, live events, steering, recovery | One-time approval, denial, clarification, status polling, and confirmed run cancellation. Event timeline, live steering, and unknown-run recovery UI remain upstream |
| Knowledge | Memory and user files, session history, context files and references, skills, optional memory plugins | Uses the Hermes profile's policies and server-side history. Mithra Preferences can add optional context. Local transcript retention is separate |
| Tools | Browser, files, terminal, web, media, delegation, MCP | Hermes executes the toolsets enabled on its API profile. The connection probe displays enabled toolsets and a skill count. Tool and credential configuration remain in Hermes |
| Models | Provider routes, fallbacks, budgets, credential pools, auxiliary models | Hermes selects its provider and model. Mithra's direct providers remain selectable |
| Scheduled work | Cron jobs, skills, delivery, Jobs API | Hermes jobs can be used through the agent when enabled. Job administration remains in Hermes |
| Integrations | Messaging surfaces, MCP, ACP editors, plugins, hooks, batch processing | Hermes owns those surfaces and integrations. Mithra exposes agent tasks, run controls, and capability inspection |
| Multimedia | Native voice, wake word, multimodal input, image generation, TTS | Mithra uses Gemini Live Sinhala voice and the robot avatar. Voice can delegate to Hermes. Image input and upstream wake-word configuration remain upstream |
| Desktop settings | Upstream desktop/TUI dashboards, profiles, personalities, themes | Mithra uses its own interface and installer. Hermes setup, profiles, personalities, and configuration management remain upstream |

Sources include the [upstream feature guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview), [Runs and Skills API](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server), and [native Windows setup](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native).

## Setup

1. Install and configure [Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native) and a model provider. Use a build that supports the Runs and Capabilities endpoints.
2. In your Hermes profile's .env file, set API_SERVER_ENABLED=true, API_SERVER_HOST=127.0.0.1, and API_SERVER_KEY to a strong unique key. Run **hermes gateway**. The default port is 8642.
3. In Mithra, select **Settings → Text provider → Hermes Agent · local gateway**. Enter **http://127.0.0.1:8642/v1** and the server key. Choose **Test Hermes connection**, then **Save & close**.
4. Start a new task, or ask Gemini Live to delegate a background task. Choose **Allow once** or **Deny** when Hermes requests approval. **Stop** calls the Hermes stop endpoint and waits for the reported outcome.
5. Enable **Keep text task history on this device** to restore task tabs and their session IDs after restarting Mithra. Hermes stores the authoritative transcript under its own session settings.

Mithra connects to loopback endpoints and keeps the key in its encrypted provider settings. Hermes tools execute on the gateway machine according to the selected profile. The desktop installer includes the Mithra interface and API client. Install and update Hermes separately.
