const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env.ELECTRON_DEV) win.loadURL("http://localhost:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}

// Salva a tela atual em PDF. Usa o CSS de impressão (src/print.css): sem navbar, botões e filtros.
ipcMain.handle("salvar-pdf", async (evento, nomeSugerido) => {
  const win = BrowserWindow.fromWebContents(evento.sender);
  if (!win) return { ok: false, erro: "Janela não encontrada." };
  const nome = typeof nomeSugerido === "string" && /^[\w.-]+$/.test(nomeSugerido) ? nomeSugerido : "relatorio.pdf";
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: nome,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { ok: false, cancelado: true };
  try {
    const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
    await fs.promises.writeFile(filePath, pdf);
    return { ok: true, caminho: filePath };
  } catch (e) {
    return { ok: false, erro: String((e && e.message) || e) };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
