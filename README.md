# Local AI Email Summarizer

_This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)_

A documented React + TypeScript + Vite app that turns a pasted email into a 2–3 sentence summary, action items, and two possible replies. All AI requests go directly from the browser to the OpenAI-compatible server you configure.

## Run locally

Use Node.js 24 or newer (including for the built-in TypeScript test runner).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

## Connect your model

1. Start an OpenAI-compatible LLM server with a chat-capable model loaded.
2. Open Settings using the top-right connection button or the sidebar settings icon.
3. Enter the protocol, IP address or hostname, port, and API base path. For example, a server on this machine might use `http://127.0.0.1:1234/v1`; a network server might use `http://192.168.1.20:11434/v1`. Use the address and port your server actually exposes. Bracket IPv6 addresses, e.g. `[::1]`.
4. Optionally enter an API key. It is kept in memory for this session only.
5. Click **Load models**, which requests `GET {base}/models`, and select a model. If discovery is unsupported, enter the model ID manually.
6. Save settings, paste an email, choose a reply tone, and click **Summarize email**.

The app calls `POST {base}/chat/completions` using `model`, `messages`, `stream: false`, and the selected output format. **JSON Schema** is the default: it sends OpenAI-compatible `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`. The schema separates `summary`, `action_items`, and two `replies`, each with a `title` and plain-text `body`.

Support depends on your server and model. In Settings, choose **JSON mode** (`response_format: { type: "json_object" }`) or **Prompted JSON** (no `response_format`, just JSON instructions) if JSON Schema is unsupported. Every mode uses the same client-side validation; malformed, incomplete, refused, or truncated output is rejected rather than shown as usable drafts. The app never automatically resends an email with a weaker format. JSON modes cannot guarantee factual accuracy; review every draft. Servers must support browser requests and this Chat Completions response shape. Different models vary in how reliably they follow the requested format. Content is never silently truncated by the app; the server's context window still limits email length. Discovery times out after 15 seconds and generation after 3 minutes; generation can be stopped.

### A server on another machine

- The server must listen on its network interface rather than only on loopback, and its firewall must permit connections from your computer.
- Enable CORS on the LLM server for the app's exact origin (by default, `http://localhost:5173`). Permit GET, POST, OPTIONS, `Content-Type`, and `Authorization` if using a key. The app cannot bypass a server's CORS policy.
- `127.0.0.1` and `localhost` always refer to the machine running the browser.
- Browsers may ask for local-network access; allow it for this app when connecting to your server.
- An HTTPS page may block an HTTP LLM endpoint as mixed content. Run the app locally over HTTP or give your LLM server a trusted HTTPS endpoint. Do not disable browser security.
- Clipboard access generally requires localhost or HTTPS. When opening the app through an HTTP LAN IP, clipboard buttons may be unavailable; open it on localhost or use HTTPS instead. Output remains manually selectable.

## Output and copying

Results appear in separate **Summary**, **Action items**, and **Suggested replies** sections. Each reply has a **Copy reply** button that copies only that reply's body as `text/plain`, preserving paragraph breaks. Titles, the summary, action items, and other replies are excluded. Reply bodies are displayed as literal text, while summary and action-item Markdown use the safe renderer.

Switch to Markdown source for a combined export. The **Copy all** menu supports:

- **Rich HTML**: copies rendered HTML and a plain-text fallback for pasting into email editors.
- **Plain text**: copies readable text with headings and list boundaries.
- **Markdown**: copies a combined Markdown export generated from the validated result.

Raw HTML in rendered Markdown is ignored. Remote images are replaced with text and links are rendered as text, so generated content cannot load tracking pixels or navigate to a URL. Reply bodies are escaped literal text, including when exported as HTML. React escapes every rendered text node; model output never enters `innerHTML`. Replies are drafts for you to review and copy; nothing is sent automatically.

## Privacy

- No accounts, analytics, cloud AI, backend proxy, external fonts, or runtime CDN dependencies.
- Email text, generated output, and API keys exist only in React memory. Reloading or clearing the workspace discards them.
- **Remember connection** saves only the protocol, address, port, API path, model, and output format in local storage. Turn it off to remove saved preferences and use session-only settings.
- Requests omit cookies and referrers, reject redirects, and request no HTTP caching.
- Your configured server receives the email and controls its own logging, retention, and upstream connections. Use a server you trust. HTTP network traffic is unencrypted; configure HTTPS if transport encryption is needed.
- Copying sends data to your operating system clipboard, whose history or synchronization settings are outside this app's control.

## Code map

- `src/App.tsx`: workspace, generation lifecycle, cancellation, and copy controls.
- `src/SettingsModal.tsx`: native accessible dialog, model discovery, selection, and preference storage.
- `src/lib/llm.ts`: validated connection URLs, OpenAI-compatible requests, prompts, and error handling.
- `src/lib/results.ts`: JSON Schema, runtime result validation, and combined Markdown export.
- `src/ResultSections.tsx`: separate result sections and individual plain-text reply copy controls.
- `src/Markdown.tsx`: Markdown token parsing into a fixed set of safe React elements, shared by the UI and clipboard.
- `src/index.css` and `src/App.css`: local fonts, dark theme, responsive layouts, and reduced-motion support.
- `tests/*.test.mjs`: Node's built-in tests for transport, structured results, validation, response errors, and privacy-sensitive storage behavior.

```sh
npm test
npm run build
```
