# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## 1.9.3 (2026-02-20)

### Features

- OpenAI Codex model support: `OpenAIProvider` detects Codex models and routes them through the Responses API (separate `instructions` parameter, `response.output_text.delta` streaming events) while non-Codex models continue using Chat Completions
- Codex-first model selection: OpenAI provider defaults to GPT-5.2 Codex in the model picker; other models (o3, gpt-4.1, o4-mini) remain accessible via "Other"

## 1.9.2 (2026-02-20)

### Features

- `/rebuild` command in build mode: manually trigger `npm install` + `npm run build` without asking the AI

### Fixes

- Fixed pasted text remnants leaking into the next prompt by clearing readline's internal line buffer

## 1.9.1 (2026-02-20)

### Fixes

- `/model` command reuses the stored API key when switching models within the same provider instead of re-prompting
- Fixed OpenAI model choices using Codex models (Responses API only) instead of Chat Completions-compatible models (o3, GPT-4.1, o4-mini)

## 1.9.0 (2026-02-20)

### Features

- Streaming responses in `/build` mode: AI responses stream token-by-token with real-time display instead of waiting for the full response
- Auto-rebuild after code changes: `/build` automatically runs `npm install` (when `package.json` changed) and `npm run build` after applying file changes, with build errors fed back to the AI for self-correction (up to 2 retries)
- Agent-kit type awareness: the build mode coding agent now receives `@wardenprotocol/agent-kit` type definitions from `node_modules` as context, preventing hallucinated APIs
- Persistent build config: LLM provider, model, and API key stored in `~/.warden/config.json` instead of per-project, shared across all agent projects
- `/model` command in build mode: switch AI provider, model, and API key without leaving the session (clears conversation history for the new model)

### Fixes

- Fixed readline prompt showing stale text after spinner animations in `/build` mode
- Fixed generated README template using `npm run agent` instead of `npm start`

## 1.8.0 (2026-02-20)

### Features

- MetaMask deep link for mobile: on mobile browsers, "Connect MetaMask" becomes "Open in MetaMask" and redirects to MetaMask's in-app browser via universal link, where `window.ethereum` is injected and all existing payment/reputation flows work unchanged
- Responsive mobile layout for the scaffolded agent chat UI: reduced paddings, scaled typography, larger touch targets for wallet buttons and feedback stars, and proper wrapping on narrow screens
- Info bar (description, capabilities, reputation) now scrolls with the conversation instead of staying fixed, reclaiming vertical space on mobile

### Breaking Changes

- Removed Solana/SVM support: Phantom wallet integration, Solana network choices in `/new` wizard, `@x402/svm` dependency, Solana address validation, and Solana block explorer URLs have all been removed. x402 payments are now EVM-only (Base Sepolia and Base mainnet).

## 1.7.1 (2026-02-19)

### Features

- Markdown rendering for agent responses: lazy-loads `marked` from CDN, progressively upgrades plain text to rendered GFM with headings, code blocks, lists, tables, and links
- Payment amount shown in system message when agent has x402 pricing configured

## 1.7.0 (2026-02-19)

### Features

- ERC-8004 on-chain reputation display in scaffolded agent front-end: aggregated star rating, numeric score, and review count fetched from ReputationRegistry across all registered chains
- Feedback submission: 5-star rating row on every agent message, auto-switches wallet to cheapest L2 for minimal gas fees
- Pre-flight ownership check prevents MetaMask transaction popup when agent owner tries to self-rate
- Dynamic favicon from agent card `image` field

### Fixes

- Payment transaction hash now always links to block explorer (fallback to wallet's current chain when `payment.network` doesn't match directly)
- Star rating hover fills all stars up to the hovered one with green color instead of highlighting individually

### Improvements

- Removed skills display from front-end (OASF tag paths were not user-friendly); example prompts still work
- `supportedTrust: ["reputation"]` added to agent registration template
- Shared `ensureViem()` helper for lazy-loading viem (reused by x402 payments and reputation)

## 1.6.0 (2026-02-19)

### Features

- Bundled front-end for scaffolded agents: every new agent gets a `public/index.html` with a chat UI that loads the agent card, displays capabilities, skills, provider info, and example prompts as conversation starters
- Static file serving from `public/`: custom HTTP server uses a `serveStatic` function with MIME type support; Express path uses `express.static`; any file in `public/` is automatically served
- ERC-8004 agent registration: scaffolds `agent-registration.json` (in `public/.well-known/` and `public/` root) with compliant structure including x402 support and network metadata
- Agent card moved to `public/.well-known/agent-card.json` with a static `url` field; startup logs a warning if it doesn't match the server's `AGENT_URL`
- x402 payment UX: eager wallet loading on page load, MetaMask chain detection via `eth_chainId`, payment transaction hashes link to block explorers, wallet buttons conditionally shown based on configured networks (EVM-only agents hide Phantom, Solana-only agents hide MetaMask)

### Fixes

- Rebuild viem wallet client on MetaMask chain change instead of mutating via `Object.assign`, fixing "chainId must match active chainId" errors
- Auto-switch MetaMask to the required chain before signing x402 payments, resolving per-site chain permission mismatches

### Improvements

- Dockerfile copies `public/` directory instead of single `agent-card.json`
- Deduplicated `listenBlock` in scaffolder (single definition reused by both x402 and non-x402 paths)

## 1.5.0 (2026-02-19)

### Features

- Auto-tag agent skills with OASF (Open Agentic Schema Framework) categories at scaffold time using static keyword matching against skill name and description
- 77 OASF categories across 11 domains covering natural language, coding, retrieval, security, data operations, agent orchestration, evaluation, infrastructure, governance, integration, and strategic reasoning
- Tags appear as `"oasf:<path>"` strings in the generated `agent-card.json` (e.g., `"oasf:natural_language/generation/dialogue_generation"`)

## 1.4.1 (2026-02-18)

### Fixes

- Generated Dockerfile now copies `agent-card.json` into the production image, fixing a startup crash when running in containers
- Renamed generated npm script from `agent` to `start` to follow Node.js conventions

## 1.4.0 (2026-02-18)

### Features

- Extract x402 payment logic into separate `payments.ts` module: generated agents get a dedicated file for all payment setup, keeping `server.ts` focused on server lifecycle
- PayAI facilitator authentication: generated agents use `@payai/facilitator` for automatic JWT-based auth when the facilitator URL points to `payai.network`
- Single `X402_FACILITATOR_URL` env var replaces per-network facilitator URLs (the x402 middleware only supports one facilitator)

### Fixes

- Echo template A2A state machine: added missing `working` state transition before `completed`, fixing "Invalid task state transition" warnings from AgentServer

### Improvements

- Generated `.env.example` uses empty placeholder values instead of leaking actual wallet addresses from the wizard
- PayAI API credential hints only shown for mainnet configurations (testnet-only agents skip them)
- Consolidated `buildPaymentsModule()` as an independently testable function for generating the payments module

## 1.3.0 (2026-02-18)

### Features

- Multi-network x402 payment support: agents can accept payments on Base Sepolia, Base mainnet, Solana Devnet, and Solana mainnet
- Per-network facilitator URLs: testnet networks default to x402.org, mainnet networks default to PayAI facilitator
- Payment configuration via per-network environment variables (`X402_<PREFIX>_PAY_TO`, `_PRICE`, `_NETWORK`, `_FACILITATOR_URL`)
- Payments auto-disable when no pay-to address is configured (server falls back to standard listen)
- Wizard supports adding multiple payment networks with per-network wallet address validation (EVM and Solana)
- `.env.example` includes all network sections with disabled networks commented out for easy enabling
- Facilitator URL validation at startup: all enabled networks must use the same facilitator

### Improvements

- Payment details no longer hardcoded in generated `server.ts`; read from environment variables at runtime
- `AgentConfig.x402` type updated to support multiple networks via `accepts` array

## 1.2.1 (2026-02-17)

### Fixes

- x402 payments are now only active when `X402_PAY_TO_ADDRESS` is set; unsetting the env var disables payments at runtime without re-scaffolding

## 1.2.0 (2026-02-17)

### Features

- Optional x402 payment support in `/new` wizard: generated agents can charge per request using USDC on Base via Coinbase's HTTP 402 protocol
- When enabled, generated `server.ts` wraps AgentServer with Express + `@x402/express` middleware
- Wizard prompts for wallet address, price per request, and network (Base Sepolia or Base mainnet)
- Generated `.env`, `package.json`, and `README.md` include x402 configuration when enabled
- CORS headers included in x402 Express wrapper for browser-based clients

### Fixes

- Fixed spinner not animating during `npm install` in `/new` (switched from blocking `execSync` to async `exec`)
- Fixed `ora` spinner stealing stdin by setting `discardStdin: false`

### Improvements

- Aligned banner and help text indentation
- Added wallet address validation tests and x402 template integration tests (198 total tests)

## 1.1.4 (2026-02-15)

### Improvements

- Bumped `@wardenprotocol/agent-kit` template dependency from `^0.3.1` to `^0.5.0`

## 1.1.3 (2026-02-13)

### Fixes

- Fixed inaccurate capability descriptions in `/new` wizard — streaming and multi-turn descriptions now reflect actual template behaviour

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
