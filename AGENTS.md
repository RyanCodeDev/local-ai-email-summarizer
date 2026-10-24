# Repository Guidelines

## Project Structure & Module Organization

Signal is a browser-only React + TypeScript application built with Vite.

- `src/App.tsx` manages the email workspace, generation, cancellation, and clipboard controls.
- `src/SettingsModal.tsx` handles connection settings and model discovery.
- `src/lib/llm.ts` owns URL validation, OpenAI-compatible requests, and prompts.
- `src/Markdown.tsx` renders Markdown into safe React elements.
- `src/App.css` and `src/index.css` define responsive layouts and global styling.
- `src/assets/` contains bundled assets; `public/` contains directly served assets.
- `tests/llm.test.mjs` covers transport and privacy behavior. Production output goes into ignored `dist/`.

## Build, Test, and Development Commands

Use Node.js 24 or newer.

- `npm ci`: install dependencies from the lockfile.
- `npm run dev`: start Vite for local development.
- `npm run build`: type-check TypeScript and build production assets.
- `npm run preview`: serve the production build locally.
- `npm test`: run Node's built-in tests without process isolation.
- `npm run lint`: run ESLint, including TypeScript, React Hooks, and Fast Refresh rules.

## Coding Style & Naming Conventions

Use two-space indentation, functional React components, and explicit TypeScript interfaces for shared data. Follow surrounding quote and semicolon conventions; no repository-wide formatter is configured. Name components in PascalCase (`SettingsModal.tsx`), functions and variables in camelCase, and constants in uppercase where appropriate (`SETTINGS_KEY`). Keep API logic separate from presentation. Document privacy constraints and asynchronous cancellation behavior, rather than narrating obvious code.

## Testing Guidelines

Use `node:test` and `node:assert/strict`; name test files `tests/*.test.mjs`. Mock `fetch` and browser storage instead of depending on a live LLM. Restore globals after each test. Cover meaningful changes to validation, discovery, response handling, cancellation, and sensitive-data handling. No numeric coverage threshold is configured. Run `npm test` and `npm run build`; manually verify responsive layouts and clipboard behavior for UI changes.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout, so no established commit convention can be confirmed. Use concise, imperative subjects such as `Fix model discovery cancellation`. Keep changes focused. PRs should explain behavior, list validation results and limitations, link relevant issues, and include screenshots for visual changes.

## Security & Configuration

Send emails only to the configured server. Never persist or log email content, results, or API keys. Store only allowlisted connection preferences. Preserve safe Markdown rendering, blocked remote assets, and abort handling. Do not add analytics, runtime CDN dependencies, or a cloud proxy. Document CORS and HTTPS requirements without advising users to disable browser security.
