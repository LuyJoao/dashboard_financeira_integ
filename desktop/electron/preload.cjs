const { contextBridge, ipcRenderer } = require("electron");

// Única coisa que a página pode pedir ao Electron: salvar o PDF da tela atual.
contextBridge.exposeInMainWorld("integ", {
  salvarPdf: (nomeSugerido) => ipcRenderer.invoke("salvar-pdf", nomeSugerido),
});
