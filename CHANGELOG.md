# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
