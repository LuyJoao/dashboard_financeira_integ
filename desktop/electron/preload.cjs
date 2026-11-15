const { contextBridge, ipcRenderer } = require("electron");

// Só estas funções ficam disponíveis para a página (window.integ).
contextBridge.exposeInMainWorld("integ", {
  salvarPdf: (nomeSugerido) => ipcRenderer.invoke("salvar-pdf", nomeSugerido),
  token: {
    ler: () => ipcRenderer.invoke("token:ler"),
    salvar: (token) => ipcRenderer.invoke("token:salvar", token),
    apagar: () => ipcRenderer.invoke("token:apagar"),
  },
});
