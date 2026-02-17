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
│   └── server.ts     # Server setup and configuration
├── agent-card.json   # Agent identity, capabilities, and skills (A2A protocol)
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
npm run agent
```

Your agent will be available at `http://localhost:3000`.

## x402 Payments

Agents can optionally charge per request using [x402](https://x402.org), Coinbase's HTTP 402 payment protocol. When enabled during `/new`, the generated agent wraps its server with Express and the `@x402/express` middleware. Clients that support x402 (such as `@x402/fetch`) automatically handle the payment flow: the server returns HTTP 402 with payment requirements, the client signs a USDC transaction, and the server verifies payment before processing the request.

### How it works

1. During `/new`, choose "Enable x402 payments" when prompted
2. Provide your wallet address (the address that receives payments)
3. Set a price per request (default: `$0.01`)
4. Choose a network: **Base Sepolia** (testnet) or **Base** (mainnet)

The wizard generates a `server.ts` that uses Express with x402 payment middleware in front of the standard A2A and LangGraph handlers. When x402 is not enabled, the generated code uses the standard `AgentServer.listen()` with no Express dependency.

### Configuration

When x402 is enabled, these environment variables are added to `.env`:

| Variable | Description |
|----------|-------------|
| `X402_PAY_TO_ADDRESS` | Your wallet address to receive USDC payments |
| `X402_PRICE` | Price per request in USD (e.g. `$0.01`) |
| `X402_NETWORK` | Blockchain network (`eip155:84532` for Base Sepolia, `eip155:8453` for Base) |
| `X402_FACILITATOR_URL` | Payment facilitator URL (default: `https://x402.org/facilitator`) |

### Networks

**Base Sepolia (testnet)** is recommended for development. It works with the default facilitator at `https://x402.org/facilitator` and uses testnet USDC (no real funds required).

**Base (mainnet)** requires a Coinbase CDP facilitator with API keys. The default facilitator does not support mainnet.

### Generated dependencies

When x402 is enabled, the following packages are added to the generated agent:

- `express` and `@types/express`
- `@x402/express` (payment middleware)
- `@x402/core` (protocol types and facilitator client)
- `@x402/evm` (EVM payment scheme verification)

## Build Mode

Run `/build` inside a scaffolded project to enter an AI-powered chat session. Describe the changes you want and the LLM will modify your agent code directly. Requires an OpenAI or Anthropic API key (configured on first run).

While in build mode you can type `/chat` to talk to your running agent without leaving the session. The URL is resolved automatically from your project's `.env` (`AGENT_URL`), or you can pass it explicitly (e.g. `/chat http://localhost:3000`). Type `/exit` inside the chat sub-session to return to build mode.

## Chatting with an Agent

Run `/chat http://localhost:3000` to interact with a running agent. The CLI auto-detects whether the agent supports A2A, LangGraph, or both, and prompts you to choose when multiple protocols are available.

## Hosting Your Agent

To host your agent on a server, you can use a cloud provider like AWS, Google Cloud, or Azure. You can also use a containerization platform like [Render.com](https://render.com/) to deploy your agent as a Docker container.

## License

Apache-2.0
