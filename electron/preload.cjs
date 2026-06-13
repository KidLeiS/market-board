const { contextBridge } = require("electron");

const apiBaseArgument = process.argv.find((arg) => arg.startsWith("--market-api-base="));
const apiBase = apiBaseArgument?.split("=")[1] || "http://127.0.0.1:4173";

contextBridge.exposeInMainWorld("marketConfig", {
  apiBase
});
