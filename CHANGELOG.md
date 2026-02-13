# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## 1.1.2 (2026-02-13)

### Improvements

- Clarified `/new` wizard: "Select a model" renamed to "Select a template" with expanded descriptions
- Clarified capability selection: "Select capability" renamed to "Select a communication style for your agent"
- Added explanation of what skills are before the skills prompt
- Configuration summary now shows "Template" instead of "Model"
- Added "What was created" section after scaffolding, listing key files and their purpose
- Expanded "Next steps" with numbered guidance and annotated manual commands
- Clarified Build Mode Setup: explains the AI provider is for the coding assistant, not the agent
- Build mode entry message now mentions `/chat` sub-command
- `/chat` probe failure now shows actionable instructions on how to start the agent
- `/chat` in build mode shows a tip to ensure the agent is running

## 1.1.1 (2026-02-13)

### Fixes

- `/new` now always creates a `.env` file with default `HOST`, `PORT`, and `AGENT_URL` values, not just for OpenAI templates — fixes `/chat` in build mode not finding the agent URL
- Fixed `RequestInfo` type errors in test files that broke `pnpm build`

### Improvements

- Extracted agent card from hardcoded `server.ts` into a separate `agent-card.json` file that is loaded at runtime
- Added `agent-card.json` to build mode project context so the AI can see and modify it
- Updated generated project structure in README

## 1.1.0 (2026-02-13)

### Features

- `/chat` sub-command inside `/build` mode — chat with a running agent without leaving build context (build.ts, chat.ts)
- Auto-resolve agent URL from the project `.env` (`AGENT_URL`) when using `/chat` in build mode
- Prompt for agent URL if no `.env` and no argument provided
- `/release` Claude Code skill for automated release preparation (.claude/skills/release)

### Fixes

- Fixed `RequestInfo` type errors in test files that broke `pnpm build`

### Improvements

- Extracted `runChatSession()` as a reusable function from `chat.ts` for code reuse (6e67cc6)
- Added tests for `readAgentUrl` helper (build.test.ts)
- Added more tests for existing functionality (6e67cc6)
