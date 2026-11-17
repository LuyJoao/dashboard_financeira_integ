import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { criarArmazemToken } = require("./token-store.cjs");
let pasta;

afterEach(() => {
  if (pasta) fs.rmSync(pasta, { recursive: true, force: true });
  pasta = undefined;
});

describe("cofre local de token", () => {
  it("persiste apenas o texto criptografado e remove a sessão ao sair", () => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "integ-token-"));
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (token) => Buffer.from(`enc:${Buffer.from(token).toString("base64")}`),
      decryptString: (dados) => Buffer.from(dados.toString().slice(4), "base64").toString(),
    };
    const armazem = criarArmazemToken({ pasta, safeStorage });
    const arquivo = path.join(pasta, "sessao.bin");
    const token = "token-sensivel-de-teste";

    expect(armazem.salvar(token)).toBe(true);
    expect(fs.readFileSync(arquivo, "utf8")).not.toContain(token);
    expect(armazem.ler()).toBe(token);
    expect(armazem.apagar()).toBe(true);
    expect(fs.existsSync(arquivo)).toBe(false);
  });

  it("não grava token quando a criptografia do sistema está indisponível", () => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "integ-token-"));
    const armazem = criarArmazemToken({
      pasta,
      safeStorage: { isEncryptionAvailable: () => false },
    });

    expect(armazem.salvar("token-sensivel-de-teste")).toBe(false);
    expect(fs.existsSync(path.join(pasta, "sessao.bin"))).toBe(false);
  });
});
