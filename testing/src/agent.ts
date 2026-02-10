import "dotenv/config";
import { AgentServer } from "@wardenprotocol/agent-kit";
import type { TaskContext, TaskYieldUpdate } from "@wardenprotocol/agent-kit";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;

const server = new AgentServer({
  agentCard: {
    name: "test",
    description: "test",
    url: BASE_URL,
    version: "0.1.0",
    capabilities: {
      streaming: true,
      multiTurn: false,
    },
    skills: [{
        id: "info",
        name: "Info",
        description: "Info capability",
        tags: [],
      }],
  },
  handler: async function* (context: TaskContext): AsyncGenerator<TaskYieldUpdate> {
    const userMessage = context.message.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");

    if (!userMessage) {
      yield {
        state: "completed",
        message: {
          role: "agent",
          parts: [{ type: "text", text: "No message provided." }],
        },
      };
      return;
    }

    // TODO: Implement your agent logic here
    yield {
      state: "completed",
      message: {
        role: "agent",
        parts: [{ type: "text", text: `Echo: ${userMessage}` }],
      },
    };
  },
});

server.listen(PORT).then(() => {
  console.log(`test (Dual Protocol)`);
  console.log(`Server: ${BASE_URL}`);
  console.log();
  console.log("A2A Protocol:");
  console.log(`  Agent Card: ${BASE_URL}/.well-known/agent-card.json`);
  console.log(`  JSON-RPC:   POST ${BASE_URL}/`);
  console.log();
  console.log("LangGraph Protocol:");
  console.log(`  Info:       ${BASE_URL}/info`);
  console.log(`  Assistants: ${BASE_URL}/assistants`);
  console.log(`  Threads:    ${BASE_URL}/threads`);
  console.log(`  Runs:       ${BASE_URL}/runs`);
});
