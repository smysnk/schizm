import cors from "cors";
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { env } from "./config/env";
import { runMigrations } from "./db/migrations";
import { pool } from "./db/pool";
import { resolvers } from "./graphql/resolvers";
import { typeDefs } from "./graphql/schema";
import { ensureDemoGraph } from "./repositories/graph-repository";
import { PromptRunner } from "./services/prompt-runner";
import { setPromptRunner } from "./services/prompt-runner-registry";

const bootstrap = async () => {
  await runMigrations();

  if (env.seedDemoGraph) {
    await ensureDemoGraph();
  }
};

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    await bootstrap();
  } catch (error) {
    console.error("Failed to initialize server", error);
    process.exit(1);
  }

  if (process.argv.includes("--migrate-only")) {
    console.log("Migrations completed.");
    await pool.end();
    return;
  }

  const app = express();
  const promptRunner = new PromptRunner();
  setPromptRunner(promptRunner);
  const server = new ApolloServer({
    typeDefs,
    resolvers
  });

  await server.start();

  app.get("/health", async (_request, response) => {
    try {
      await pool.query("SELECT 1");
      response.json({ status: "ok" });
    } catch (_error) {
      response.status(500).json({ status: "error" });
    }
  });

  app.use(
    env.graphqlEndpoint,
    cors({ origin: true, credentials: true }),
    express.json(),
    expressMiddleware(server)
  );

  app.listen(env.serverPort, () => {
    console.log(`GraphQL server ready at ${env.serverUrl}${env.graphqlEndpoint}`);
    void promptRunner.start();
  });

  process.once("SIGINT", () => promptRunner.stop());
  process.once("SIGTERM", () => promptRunner.stop());
};

void startServer();
