# Warden

Interactive CLI for bootstrapping Warden agents with support for both A2A and LangGraph protocols.

## Installation

```bash
npm install -g warden-code
# or
npx warden-code
```

## Usage

```bash
warden
```

This launches an interactive CLI where you can create new agents.

### Commands

| Command | Description |
|---------|-------------|
| `/new [path]` | Create a new agent interactively [optionally provide a path] |
| `/help` | Show available commands |
| `/clear` | Clear the terminal |
| `/exit` | Exit the CLI |

## Creating an Agent

Run `/new` to start the agent creation wizard:

1. **Agent name** - a name for your agent
2. **Description** - what your agent does
3. **Template** - Blank (echo) or OpenAI (GPT-powered)
4. **Capability** - Streaming or Multi-turn conversations
5. **Skills** - Define agent capabilities (optional)

After generation, your agent will be ready at `src/agent.ts`.

## Templates

| Template | Description |
|----------|-------------|
| **Blank + Streaming** | Minimal streaming agent that echoes input |
| **Blank + Multi-turn** | Minimal multi-turn conversation agent |
| **OpenAI + Streaming** | GPT-powered agent with streaming responses |
| **OpenAI + Multi-turn** | GPT-powered agent with conversation history |

All templates use `AgentServer` from `@wardenprotocol/agent-kit`, which exposes both:
- **A2A Protocol** - JSON-RPC at `POST /`, discovery at `GET /.well-known/agent-card.json`
- **LangGraph Protocol** - REST API at `/assistants`, `/threads`, `/runs`

## Generated Project Structure

```
my-agent/
├── src/
│   └── agent.ts      # Your agent code
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Running Your Agent

```bash
cd my-agent
npm install
npm run build
npm run agent
```

Your agent will be available at `http://localhost:3000`.

## License

Apache-2.0
