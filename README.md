# Warden

Interactive CLI for bootstrapping Warden agents with support for both A2A and LangGraph protocols.

## Getting Started

Install the CLI globally:

```bash
npm install -g warden-code
```

Then run it with:

```bash
warden
```

Or just run it directly:

```bash
npx warden-code
```

This launches an interactive CLI where you can create new agents.

### Commands

| Command | Description |
|---------|-------------|
| `/new [path]` | Create a new agent interactively [optionally provide a path] |
| `/build [path]` | Enter AI-powered build mode to modify your agent via chat |
| `/chat <url>` | Chat with a running agent via A2A or LangGraph |
| `/help` | Show available commands |
| `/clear` | Clear the terminal |
| `/exit` | Exit the CLI |

## Creating an Agent

Run `/new` to start the agent creation wizard:

1. **Agent name** - a name for your agent
2. **Description** - what your agent does
3. **Model** - Echo (just a demo that echoes input) or OpenAI (GPT-powered)
4. **Capability** - Streaming or Multi-turn conversations
5. **Skills** - Define agent capabilities (optional)
6. **x402 Payments** - Optionally gate requests behind per-request USDC payments (see [x402 Payments](#x402-payments) below)

Skills are automatically tagged with [OASF](https://docs.agntcy.org/oasf/open-agentic-schema-framework/) categories based on their name and description. Tags use the format `oasf:<path>` (e.g., `oasf:natural_language/generation/dialogue_generation`) and appear in the generated `agent-card.json`.

After generation, your agent will be ready at `src/agent.ts`.

## Models

| Model | Description |
|----------|-------------|
| **Echo + Streaming** | Minimal streaming agent that echoes input |
| **Echo + Multi-turn** | Minimal multi-turn conversation agent |
| **OpenAI + Streaming** | GPT-powered agent with streaming responses |
| **OpenAI + Multi-turn** | GPT-powered agent with conversation history |

All options use `AgentServer` from `@wardenprotocol/agent-kit`, which exposes both:
- **A2A Protocol**
- **LangGraph Protocol**

## Generated Project Structure

```
my-agent/
├── src/
│   ├── agent.ts      # Your agent logic (handler function)
│   ├── server.ts     # Server setup, static file serving, protocol routing
│   └── payments.ts   # x402 payment setup (only when payments enabled)
├── public/
│   ├── index.html    # Chat front-end (auto-loads agent card, skills, x402 wallets)
│   ├── agent-registration.json   # ERC-8004 registration metadata
│   └── .well-known/
│       ├── agent-card.json           # Agent identity, capabilities, skills (A2A)
│       └── agent-registration.json   # ERC-8004 registration metadata
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── .gitignore
```

## Running Your Agent

```bash
cd my-agent
npm run build
npm start
```

Your agent will be available at `http://localhost:3000`.

### Front-end

Every scaffolded agent includes a chat front-end at `http://localhost:3000/`. It loads the agent card from `/.well-known/agent-card.json` and displays the agent name, description, capabilities, skills, and provider info. Example prompts from skills are shown as clickable conversation starters.

When x402 payments are enabled, the front-end reads `agent-registration.json` on page load and shows wallet connect buttons for the configured networks (MetaMask for EVM, Phantom for Solana). Payment transaction hashes in responses link to the appropriate block explorer.

The `public/` directory is served as static files. Add any additional assets (icons, stylesheets, scripts) and they will be available at their corresponding URL paths.

## x402 Payments

Agents can optionally charge per request using [x402](https://x402.org), Coinbase's HTTP 402 payment protocol. When enabled during `/new`, the generated agent wraps its server with Express and the `@x402/express` middleware. Clients that support x402 (such as `@x402/fetch`) automatically handle the payment flow: the server returns HTTP 402 with payment requirements, the client signs a USDC transaction, and the server verifies payment before processing the request.

### How it works

1. During `/new`, choose "Enable x402 payments" when prompted
2. Select a payment network (Base or Solana, testnet or mainnet)
3. Provide the wallet address for that network
4. Set a price per request (default: `0.01`)
5. Optionally add more networks (e.g., Base Sepolia + Solana Devnet)

The wizard generates a `.env` file with per-network payment variables. At runtime, the server reads these variables and conditionally enables the Express + x402 middleware layer. When no `PAY_TO` variables are set, the agent falls back to the standard `AgentServer.listen()` with no Express dependency.

### Configuration

Each payment network uses three environment variables with a shared prefix:

| Prefix | Network |
|--------|---------|
| `X402_BASE_SEPOLIA` | Base Sepolia (testnet) |
| `X402_BASE` | Base (mainnet) |
| `X402_SOL_DEVNET` | Solana Devnet |
| `X402_SOL` | Solana Mainnet |

A single facilitator URL is shared across all networks:

| Variable | Description |
|----------|-------------|
| `X402_FACILITATOR_URL` | Payment facilitator endpoint (testnet default: `x402.org`, mainnet default: `facilitator.payai.network`) |

For each prefix, three variables control the network config:

| Variable | Description |
|----------|-------------|
| `X402_<PREFIX>_PAY_TO` | Wallet address to receive payments (set to enable, remove to disable) |
| `X402_<PREFIX>_PRICE` | Price per request in USDC (default: `0.01`) |
| `X402_<PREFIX>_NETWORK` | Network identifier (pre-filled) |

Example `.env` section for Base Sepolia:

```bash
X402_FACILITATOR_URL=https://x402.org/facilitator

# Base Sepolia (testnet)
X402_BASE_SEPOLIA_PAY_TO=0xYourAddress
X402_BASE_SEPOLIA_PRICE=0.01
X402_BASE_SEPOLIA_NETWORK=eip155:84532
```

To disable a network, remove its `PAY_TO` value. To disable payments entirely, remove all `PAY_TO` values. All available networks are listed in `.env.example` (active ones uncommented, others commented out for easy enabling).

### Networks

| Network | ID | Pay-to format |
|---------|-----|---------------|
| Base Sepolia (testnet) | `eip155:84532` | `0x` + 40 hex chars |
| Base (mainnet) | `eip155:8453` | `0x` + 40 hex chars |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Base58, 32-44 chars |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Base58, 32-44 chars |

Testnet networks are recommended for development. They work with the default x402.org facilitator and use testnet USDC (no real funds required).

### Facilitator

Set `X402_FACILITATOR_URL` in `.env` to your facilitator of choice. The wizard defaults to `https://x402.org/facilitator` for testnet networks and `https://facilitator.payai.network` for mainnet.

The [PayAI facilitator](https://facilitator.payai.network) offers 1,000 free settlements per month. For higher volumes, create a merchant account at [merchant.payai.network](https://merchant.payai.network) and set `PAYAI_API_KEY_ID` and `PAYAI_API_KEY_SECRET` in your `.env`. Authentication is handled automatically via the `@payai/facilitator` package when the facilitator URL contains `payai.network`.

### Generated dependencies

When x402 is enabled, the following packages are added to the generated agent:

- `express` and `@types/express`
- `@x402/express` (payment middleware)
- `@x402/core` (protocol types and facilitator client)
- `@payai/facilitator` (facilitator authentication)
- `@x402/evm` (EVM payment scheme verification, included when Base networks are selected)
- `@x402/svm` (Solana payment scheme verification, included when Solana networks are selected)

## Build Mode

Run `/build` inside a scaffolded project to enter an AI-powered chat session. Describe the changes you want and the LLM will modify your agent code directly. Requires an OpenAI or Anthropic API key (configured on first run).

While in build mode you can type `/chat` to talk to your running agent without leaving the session. The URL is resolved automatically from your project's `.env` (`AGENT_URL`), or you can pass it explicitly (e.g. `/chat http://localhost:3000`). Type `/exit` inside the chat sub-session to return to build mode.

## Chatting with an Agent

Run `/chat http://localhost:3000` to interact with a running agent. The CLI auto-detects whether the agent supports A2A, LangGraph, or both, and prompts you to choose when multiple protocols are available.

## Hosting Your Agent

To host your agent on a server, you can use a cloud provider like AWS, Google Cloud, or Azure. You can also use a containerization platform like [Render.com](https://render.com/) to deploy your agent as a Docker container.

## License

Apache-2.0
