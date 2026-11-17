# Segurança dos saldos e dos dados financeiros (guia para o back-end)

Aplica-se primeiro à tela de **Saldos** (B4), mas vale também para lançamentos, importação, títulos e categorias,
porque todos alteram os números que o dashboard mostra.

**Como ler este documento.** Os itens 1, 2, 5 e 6 são técnicos: não mudam nenhuma regra de negócio e podem ser feitos já.
Os itens 3 e 4 (histórico, justificativa, fechamento de mês, aprovação) **mudam a rotina de quem usa** e dependem da
decisão da supervisora e, de preferência, do contador (veja "Decisões pendentes" no fim). Nada daqui deve ser ligado
sem esse aval.

Observação sobre o estado atual: ainda **não existem** rotas de saldos no `main.py`. O front funcionava com dados de exemplo.
Estas regras entram junto com o B4.

## 1. Controle de acesso no servidor (leitura e gravação)

O front esconde links e bloqueia rotas, mas isso é só conforto: quem chamar a API direto ignora tudo isso.
Toda rota de saldos precisa exigir login **no servidor**, com o mesmo padrão já usado em `/api/usuarios`.

| Rota | Quem pode (decisão atual) |
|---|---|
| `GET /api/saldos` | qualquer usuário logado e ativo |
| `PUT /api/saldos`, `PUT /api/saldos/aplicado` | admin e usuário comum (decidido com a supervisora) |
| fechar e reabrir mês (item 4) | somente admin |

Esqueleto (não testado):

```python
router = APIRouter(prefix="/api/saldos", tags=["saldos"], dependencies=[Depends(usuario_atual)])  # 401 sem login

@router.put("")
def salvar(dados: SaldoEdicao, request: Request, user: Usuario = Depends(usuario_atual), db: Session = Depends(get_db)):
    ...
```

- Se a supervisora decidir que só o admin informa saldos, troque `usuario_atual` por `exigir_admin` na gravação.
- Usuário desativado perde o acesso na hora (`usuario_atual` já confere `ativo` a cada pedido).
- Testes (pytest): sem token → 401; token inválido → 401; usuário desativado → 401; usuário comum em rota de admin → 403.

## 2. Validação dos dados na API

Nunca confie no front. Validar tudo com Pydantic e devolver `detail` **em texto** (o front só exibe `detail` quando é texto;
o 422 padrão do FastAPI devolve uma lista, então registre um tratador global que a converta em frase).

```python
LIMITE = 10_000_000_000  # R$ 100 milhões em centavos; ajuste ao porte real da instituição

class SaldoEdicao(BaseModel):
    mes: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")   # AAAA-MM
    conta_id: int
    saldo_inicial: int = Field(ge=-LIMITE, le=LIMITE)       # inteiro em centavos, nunca decimal
    saldo_extrato: int | None = Field(default=None, ge=-LIMITE, le=LIMITE)
    justificativa: str | None = Field(default=None, max_length=500)
    comprovante: str | None = Field(default=None, max_length=200)
```

Regras além do formato:
- a **conta existe** e está entre as 3 contas cadastradas; o **mês existe** (não pode ser futuro nem anterior a 2026-01);
- valores **inteiros** (centavos) dentro do limite; rejeitar `float`, texto e `NaN`;
- não aceitar saldo do extrato para mês futuro;
- gravar a alteração e o registro de histórico **na mesma transação** (se um falhar, nada é gravado).

Observação sobre o contrato do front: hoje ele manda o mês como rótulo ("Mai/26"). Para validar com segurança, o corpo deve
levar `AAAA-MM`; a conversão é uma linha em `api/saldos.ts`. Combinar antes de implementar.

## 3. Trilha de auditoria (não pode ser apagada nem alterada) — DEPENDE DE DECISÃO

Tabela só de inclusão. Testada em PostgreSQL:

```sql
CREATE TABLE saldos_historico (
  id BIGSERIAL PRIMARY KEY,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  mes CHAR(7) NOT NULL CHECK (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  conta_id INTEGER NOT NULL REFERENCES contas(id),
  campo TEXT NOT NULL CHECK (campo IN ('saldo_inicial','saldo_extrato','saldo_aplicado')),
  valor_anterior BIGINT,
  valor_novo BIGINT,
  justificativa TEXT NOT NULL CHECK (length(btrim(justificativa)) >= 10),
  comprovante TEXT,          -- referência ao documento (nome ou número do extrato); o arquivo em si fica fora do banco
  ip INET
);

CREATE FUNCTION bloquear_alteracao_historico() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de saldos não pode ser alterado nem apagado.' USING ERRCODE = 'restrict_violation';
END; $$;

CREATE TRIGGER saldos_historico_linha BEFORE UPDATE OR DELETE ON saldos_historico
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_historico();
CREATE TRIGGER saldos_historico_truncate BEFORE TRUNCATE ON saldos_historico
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao_historico();
```

**Dois papéis no banco** (é isso que dá força à proteção):
- `migracao`: dono das tabelas, usado **só** no `alembic upgrade head`.
- `app_runtime`: o que a API usa no dia a dia. Sem permissão de dono. Para a tabela de histórico: `GRANT SELECT, INSERT` e mais nada.

Resultado dos testes: como `app_runtime`, o `UPDATE`, o `DELETE` e o `TRUNCATE` são **recusados** (permissão negada), assim como remover ou desligar os gatilhos.
Como dono, `UPDATE`, `DELETE` e `TRUNCATE` também são recusados pelo gatilho, **mas o dono consegue remover o gatilho**.

Limite honesto: quem tem a senha do dono ou do superusuário do PostgreSQL ainda pode alterar o histórico. Isso se reduz com:
senha do dono fora da API e do `.env` do dia a dia, cópias de segurança em outro lugar (item 5) e, se necessário, um registro
externo do histórico. Para o porte atual, isso é um nível razoável.

Fluxo: no `PUT`, antes de gravar, ler o valor atual; gravar o novo valor e inserir uma linha no histórico por campo alterado
(quem, quando, mês, conta, valor anterior, valor novo, justificativa, comprovante, IP), tudo na mesma transação.
Exigir justificativa (mínimo de 10 letras) quando o saldo já existia. No front isso vira dois campos novos no formulário de saldos.

## 4. Fechamento de mês e aprovação — DEPENDE DE DECISÃO

Problema real desta tela: editar o "saldo do extrato" faz uma divergência virar "OK". Sem controle, dá para esconder um
lançamento que falta. Opções, da mais simples à mais pesada:

1. **Fechar o mês (recomendado como mínimo).** O admin fecha um mês conferido. Em mês fechado, saldos, lançamentos,
   títulos pagos e importações daquele mês ficam **bloqueados** (resposta 409, em texto). Só o admin reabre, com justificativa,
   e o fechamento e a reabertura entram numa tabela só de inclusão, como a do item 3.
2. **Aprovação por outra pessoa** para alterações relevantes (ex.: variação acima de um valor ou de uma porcentagem).
   Só faz sentido com **duas pessoas diferentes** (quem lança e quem aprova). Com um usuário só, vira burocracia sem proteção.
3. **Sem controle** (situação de hoje, só com o histórico do item 3 para consulta).

Mudanças silenciosas em período fechado devem ser impossíveis **no servidor** (as rotas verificam o fechamento), e não só escondidas no front.

## 5. Sessões, transporte, backup e monitoramento

- **Transporte:** a API hoje usa HTTP (rede interna). Para dados financeiros, colocar HTTPS na frente (por exemplo Caddy com
  certificado interno) ou acesso só por VPN. Os computadores precisam confiar no certificado. Até lá, não expor a API fora da rede interna.
- **Sessões:** token de 60 minutos (já existe); limitar tentativas de login (por exemplo 5 erros → espera de alguns minutos);
  trocar a `SECRET_KEY` se vazar; guardar o token criptografado no computador (feito no F9).
- **Backups:** agendado (veja `deploy/`), **criptografado**, com cópia em **outro disco ou outro local**, e **teste de restauração**
  pelo menos uma vez. O histórico de auditoria entra no backup.
- **Monitoramento:** guardar o registro de acessos e erros da API em arquivo com rotação; registrar login falho, 401, 403 e 5xx;
  alguém olhar periodicamente; aviso se a API ou o banco parar. Algo simples e revisado com regularidade já ajuda.
- **Acesso ao servidor e ao banco:** poucas pessoas, senha forte, sem usar o papel de dono no dia a dia.

## 6. Dados de exemplo fora da produção (já feito no front)

O build de produção não contém mais os dados de exemplo e sempre fala com a API (`desktop/src/lib/mock.ts`).
Antes dessa correção, um instalador gerado **sem** `VITE_USE_MOCK=false` ficava preso nos dados de exemplo
e nunca chamava a API de verdade.

## Decisões pendentes (levar à supervisora e ao contador)

1. Registrar histórico de alterações dos saldos (quem, quando, valor anterior e novo)? Exigir justificativa e referência do comprovante?
2. Haverá **fechamento de mês**? Quem pode fechar e reabrir?
3. Alterações grandes precisam da **aprovação de outra pessoa**? A partir de qual valor? Existe uma segunda pessoa para aprovar?
4. Só o admin pode informar saldos, ou o usuário comum também (hoje: os dois)?
5. Por quanto tempo guardar o histórico e os documentos (comprovantes, extratos)? Quem pode ver o histórico?
6. Existe obrigação contábil ou da entidade (estatuto, prestação de contas a financiadores) sobre guardar e não alterar registros?
7. Os nomes de pessoas nos lançamentos (bolsistas, prestadores) e os registros de acesso são dados pessoais: quem é o responsável
   pela proteção de dados da instituição e qual o prazo de guarda?

Isto não é parecer jurídico nem contábil. As exigências sobre escrituração, guarda de documentos e proteção de dados pessoais devem ser
confirmadas com o contador e com o responsável da instituição antes de decidir o que ligar.
