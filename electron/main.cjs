const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow;
let marketServer;

async function startEmbeddedServer() {
  const serverPath = path.join(__dirname, "..", "server", "index.js");
  const { startMarketServer } = await import(pathToFileURL(serverPath).href);
  marketServer = await startMarketServer({ port: 0 });
  return marketServer;
}

async function createWindow() {
  const server = await startEmbeddedServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1060,
    minHeight: 720,
    title: "Market Board",
    backgroundColor: "#f5f7fb",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [`--market-api-base=${server.url}`]
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_DEV_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_DEV_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (marketServer?.server) {
    marketServer.server.close();
  }
});
