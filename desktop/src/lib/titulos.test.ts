import { describe, expect, it } from "vitest";
import type { Titulo, TituloEdicao } from "../api/titulos";
import { hojeISO } from "./lancamentos";
import { diasDeAtraso, resumoTitulos, statusDoTitulo, validarTitulo } from "./titulos";
import { somaDias } from "./titulos";

const hoje = hojeISO();
const d = (dias: number) => somaDias(hoje, dias);

const titulo = (sobrescritos: Partial<Titulo> = {}): Titulo => ({
  id: 1,
  tipo: "pagar",
  empresa_id: 3,
  empresa_nome: "Empresa de teste",
  forma: "NF",
  numero: "1",
  descricao: "Teste",
  valor: 100,
  vencimento: hoje,
  pago_em: null,
  ...sobrescritos,
});

const titulosExemplo = [
  titulo({ id: 1, valor: 125000, vencimento: d(-12) }),
  titulo({ id: 2, valor: 19990, vencimento: d(-3) }),
  titulo({ id: 3, valor: 34500, vencimento: d(5) }),
  titulo({ id: 4, valor: 120000, vencimento: d(20) }),
  titulo({ id: 5, valor: 98000, vencimento: d(-30), pago_em: d(-28) }),
  titulo({ id: 6, valor: 19990, vencimento: d(-33), pago_em: d(-33) }),
  titulo({ id: 7, tipo: "receber", valor: 5000, vencimento: d(2) }),
  titulo({ id: 8, tipo: "receber", valor: 50000, vencimento: d(-8) }),
  titulo({ id: 9, tipo: "receber", valor: 5000, vencimento: d(-28), pago_em: d(-26) }),
  titulo({ id: 10, valor: 8700, vencimento: hoje }),
];

describe("regras dos títulos", () => {
  it("classifica atraso, vencimento hoje e pagamento sem depender de datas fixas do sistema", () => {
    const atrasado = titulo({ vencimento: d(-12) });

    expect(statusDoTitulo(atrasado, hoje)).toBe("vencido");
    expect(diasDeAtraso(atrasado)).toBe(12);
    expect(statusDoTitulo(titulo({ vencimento: hoje }), hoje)).toBe("vence_hoje");
    expect(statusDoTitulo(titulo({ vencimento: d(-12), pago_em: hoje }), hoje)).toBe("pago");
  });

  it("reproduz os totais de exemplo e recalcula atraso quando um título vencido é pago", () => {
    const inicial = resumoTitulos(titulosExemplo, hoje);

    expect(inicial).toMatchObject({
      aPagar: 308190,
      aReceber: 55000,
      vencidosPagar: { qtd: 2, valor: 144990 },
      vencidosReceber: { qtd: 1, valor: 50000 },
      vencemEm7Dias: { qtd: 3, valor: 48200 },
    });

    const atualizado = resumoTitulos(
      titulosExemplo.map((t) => (t.id === 1 ? { ...t, pago_em: hoje } : t)),
      hoje
    );

    expect(atualizado.aPagar).toBe(183190);
    expect(atualizado.vencidosPagar).toEqual({ qtd: 1, valor: 19990 });
    expect(atualizado.vencidosReceber).toEqual({ qtd: 1, valor: 50000 });
  });

  it("avisa sobre número em branco e data de vencimento impossível", () => {
    const dados: TituloEdicao = {
      tipo: "pagar",
      empresa_id: 3,
      forma: "NF",
      numero: "",
      descricao: "Teste",
      valor: 100,
      vencimento: "2026-02-31",
      pago_em: null,
    };

    expect(validarTitulo(dados, hoje)).toEqual([
      "Informe o número do documento.",
      "Vencimento inválido.",
    ]);
  });
});
