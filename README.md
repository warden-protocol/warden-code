# Warden

Interactive CLI for bootstrapping Warden agents.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

```bash
pnpm cli
```

### Commands

| Command | Description |
|---------|-------------|
| `/new [path]` | Create a new agent interactively |
| `/help` | Show available commands |
| `/clear` | Clear the terminal |
| `/exit` | Exit the CLI |

## Templates

Warden supports four agent templates:

- **blank-multiturn** - Basic multi-turn conversation agent
- **blank-streaming** - Basic streaming agent
- **openai-multiturn** - OpenAI-powered multi-turn agent
- **openai-streaming** - OpenAI-powered streaming agent

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Run tests
pnpm test:run

# Run tests with coverage
pnpm test:coverage

# Clean build artifacts
pnpm clean
```

## Project Structure

```
src/
├── cli/
│   ├── commands/    # Slash commands (/new, /help, etc.)
│   ├── services/    # Scaffolding and file operations
│   ├── ui/          # Terminal formatting
│   ├── context.ts   # CLI context and logger
│   └── types.ts     # TypeScript interfaces
└── templates/       # Agent templates
```

## License

Apache-2.0
