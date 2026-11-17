const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");
const { criarArmazemToken } = require("./token-store.cjs");
const { autoUpdater } = require("electron-updater");

const emDesenvolvimento = !!process.env.ELECTRON_DEV;
const ORIGEM_DEV = "http://localhost:5173";
const armazemToken = criarArmazemToken({ pasta: app.getPath("userData"), safeStorage });
const arquivoApp = path.resolve(__dirname, "../dist/index.html");

function urlPermitida(url) {
  try {
    const destino = new URL(url);
    if (emDesenvolvimento) return destino.origin === new URL(ORIGEM_DEV).origin;
    return destino.protocol === "file:" && path.resolve(fileURLToPath(destino)) === arquivoApp;
  } catch {
    return false;
  }
}

function createWindow() {
  const icone = path.join(__dirname, "../build/icon.png");
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    ...(fs.existsSync(icone) ? { icon: icone } : {}), // no instalado, o ícone vem do .exe
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: emDesenvolvimento,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // O aplicativo não navega para fora: links externos abrem no navegador do sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    let protocolo;
    try {
      protocolo = new URL(url).protocol;
    } catch {
      return { action: "deny" };
    }
    if (protocolo === "http:" || protocolo === "https:") {
      void shell.openExternal(url).catch((e) => console.error("Não foi possível abrir o link externo:", e));
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (evento, url) => {
    if (!urlPermitida(url)) evento.preventDefault();
  });
  win.webContents.on("before-input-event", (evento, entrada) => {
    const atalhoDevTools =
      (entrada.control && entrada.shift && ["i", "j", "c"].includes(entrada.key.toLowerCase())) || entrada.key === "F12";
    if (!emDesenvolvimento && entrada.type === "keyDown" && atalhoDevTools) evento.preventDefault();
  });
  win.webContents.on("devtools-opened", () => {
    if (!emDesenvolvimento) win.webContents.closeDevTools();
  });

  if (!emDesenvolvimento) win.removeMenu(); // usuário final não vê o menu do Electron (nem o atalho das ferramentas de desenvolvedor)
  if (emDesenvolvimento) win.loadURL(ORIGEM_DEV);
  else win.loadFile(arquivoApp);
  return win;
}

// ---------- token de login em armazenamento seguro ----------
ipcMain.handle("token:ler", () => armazemToken.ler());
ipcMain.handle("token:salvar", (_evento, token) => {
  const salvo = armazemToken.salvar(token);
  if (!salvo) console.warn("Token não persistido criptograficamente; esta sessão valerá até fechar o aplicativo.");
  return salvo;
});
ipcMain.handle("token:apagar", () => armazemToken.apagar());

// ---------- salvar a tela atual em PDF (usa o CSS de impressão, src/print.css) ----------
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

// ---------- atualização automática (só no aplicativo instalado) ----------
// Os arquivos da nova versão ficam no servidor da empresa. Veja atualizacoes.md.
function configurarAtualizacao(win) {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", async (info) => {
    try {
      const { response } = await dialog.showMessageBox(win, {
        type: "info",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 0,
        cancelId: 1,
        title: "Atualização pronta",
        message: `A versão ${info.version} foi baixada.`,
        detail: 'Reinicie o aplicativo para instalar. Se escolher "Depois", ela será instalada quando você fechar o aplicativo.',
      });
      if (response === 0) autoUpdater.quitAndInstall();
    } catch (e) {
      console.error("Não foi possível apresentar a atualização pronta:", e);
    }
  });
  autoUpdater.on("error", (e) => console.error("Atualização:", e && e.message));
  const verificar = () => {
    autoUpdater.checkForUpdates().catch((e) => console.error("Não foi possível verificar atualizações:", e));
  };
  verificar();
  setInterval(verificar, 4 * 60 * 60 * 1000); // e a cada 4 horas
}

// Uma janela só: abrir de novo traz a que já existe para a frente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [janela] = BrowserWindow.getAllWindows();
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });
  app.whenReady().then(() => {
    if (!emDesenvolvimento) Menu.setApplicationMenu(null);
    configurarAtualizacao(createWindow());
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
