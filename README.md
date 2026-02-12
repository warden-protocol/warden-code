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

## Build Mode

Run `/build` inside a scaffolded project to enter an AI-powered chat session. Describe the changes you want and the LLM will modify your agent code directly. Requires an OpenAI or Anthropic API key (configured on first run).

## Chatting with an Agent

Run `/chat http://localhost:3000` to interact with a running agent. The CLI auto-detects whether the agent supports A2A, LangGraph, or both, and prompts you to choose when multiple protocols are available.

## Hosting Your Agent

To host your agent on a server, you can use a cloud provider like AWS, Google Cloud, or Azure. You can also use a containerization platform like [Render.com](https://render.com/) to deploy your agent as a Docker container.

## License

Apache-2.0
