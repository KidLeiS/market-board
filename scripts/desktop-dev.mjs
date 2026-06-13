import { spawn } from "node:child_process";

const vite = spawn("vite", ["--host", "127.0.0.1", "--strictPort"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

let electron;

async function waitForVite() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:5173");
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  throw new Error("Timed out waiting for Vite at http://127.0.0.1:5173");
}

function shutdown(code = 0) {
  if (electron && !electron.killed) electron.kill();
  if (!vite.killed) vite.kill();
  process.exit(code);
}

vite.on("exit", (code, signal) => {
  if (signal) return;
  if (!electron || electron.exitCode === null) {
    shutdown(code || 0);
  }
});

try {
  await waitForVite();
  electron = spawn("electron", ["."], {
    env: {
      ...process.env,
      ELECTRON_DEV_URL: "http://127.0.0.1:5173"
    },
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  electron.on("exit", (code, signal) => {
    if (signal) return;
    shutdown(code || 0);
  });
} catch (error) {
  console.error(error);
  shutdown(1);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
