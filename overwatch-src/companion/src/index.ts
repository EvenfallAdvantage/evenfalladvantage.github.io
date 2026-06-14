import { SdrServer } from "./sdr-server.js";

const args = process.argv.slice(2);
let port = 8372;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && i + 1 < args.length) {
    port = parseInt(args[++i], 10);
  }
}

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
