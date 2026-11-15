import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apagarToken, carregarToken, lerToken, salvarToken } from "./token";

const valores = new Map<string, string>();
const armazenamento = {
  getItem: vi.fn((chave: string) => valores.get(chave) ?? null),
  setItem: vi.fn((chave: string, valor: string) => valores.set(chave, valor)),
  removeItem: vi.fn((chave: string) => valores.delete(chave)),
};

beforeEach(async () => {
  valores.clear();
  vi.stubGlobal("localStorage", armazenamento);
  vi.stubGlobal("window", { integ: undefined });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0" });
  await apagarToken();
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllGlobals());

describe("armazenamento de token", () => {
  it("não usa localStorage no Electron quando o preload não está disponível", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Electron/33.0.0" });
    armazenamento.setItem("token", "token-antigo");
    vi.clearAllMocks();

    await carregarToken();
    expect(lerToken()).toBeNull();
    expect(armazenamento.removeItem).toHaveBeenCalledWith("token");

    await salvarToken("token-novo");
    expect(lerToken()).toBe("token-novo");
    expect(armazenamento.setItem).not.toHaveBeenCalled();
  });

  it("usa a ponte criptografada no Electron e localStorage apenas no navegador", async () => {
    const tokenSeguro = {
      ler: vi.fn().mockResolvedValue("token-criptografado"),
      salvar: vi.fn().mockResolvedValue(true),
      apagar: vi.fn().mockResolvedValue(true),
    };
    vi.stubGlobal("window", { integ: { token: tokenSeguro } });

    await carregarToken();
    expect(lerToken()).toBe("token-criptografado");
    await salvarToken("novo-token");
    expect(tokenSeguro.salvar).toHaveBeenCalledWith("novo-token");
    expect(armazenamento.setItem).not.toHaveBeenCalled();

    vi.stubGlobal("window", { integ: undefined });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0" });
    await salvarToken("token-do-navegador");
    expect(armazenamento.setItem).toHaveBeenCalledWith("token", "token-do-navegador");
  });
});
