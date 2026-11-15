const fs = require("fs");
const path = require("path");

// Guarda o token de login criptografado em disco. O safeStorage do Electron usa o cofre do sistema
// (DPAPI no Windows): o arquivo só é lido por este usuário do Windows, neste computador.
function criarArmazemToken({ pasta, safeStorage }) {
  const arquivo = path.join(pasta, "sessao.bin");
  return {
    ler() {
      try {
        if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(arquivo)) return null;
        return safeStorage.decryptString(fs.readFileSync(arquivo));
      } catch (e) {
        console.error("Não foi possível ler o token criptografado:", e);
        return null; // arquivo corrompido ou de outro usuário: tratado como "não há sessão"
      }
    },
    // devolve true se gravou. Sem criptografia disponível, NÃO grava em texto puro.
    salvar(token) {
      if (typeof token !== "string" || !token || token.length > 4096) return false;
      try {
        if (!safeStorage.isEncryptionAvailable()) return false;
        fs.mkdirSync(pasta, { recursive: true });
        fs.writeFileSync(arquivo, safeStorage.encryptString(token), { mode: 0o600 });
        return true;
      } catch (e) {
        console.error("Não foi possível persistir o token criptografado:", e);
        return false;
      }
    },
    apagar() {
      try {
        fs.rmSync(arquivo, { force: true });
        return true;
      } catch (e) {
        console.error("Não foi possível apagar o token criptografado:", e);
        return false;
      }
    },
  };
}

module.exports = { criarArmazemToken };
