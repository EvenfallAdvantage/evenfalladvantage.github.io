import { SdrServer } from "./sdr-server.js";

const port = parseInt(process.argv[2] ?? "8372", 10);

const server = new SdrServer();
server.start(port).catch((err) => {
  console.error("SDR companion failed:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});
