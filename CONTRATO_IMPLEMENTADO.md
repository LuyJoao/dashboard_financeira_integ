# Contrato do backend atualmente implementado

**Objetivo:** resumir o comportamento existente do backend para revisão e continuidade por outro assistente, sem exigir a leitura integral do código.

**Importante:** este documento descreve o que está implementado hoje; não é a especificação do que ainda precisa ser feito. Os itens marcados como “ausente” ou “divergente” não devem ser tratados como funcionalidades prontas.

## 1. Resumo executivo

O backend atual oferece:

- autenticação JWT e recuperação/troca de senha;
- cadastro, edição e ativação de usuários sob perfil administrador;
- leitura de planilhas `.xlsx` com prévia e confirmação;
- histórico de importações;
- consulta filtrada e paginada de lançamentos;
- consulta e detalhe de empresas;
- dashboard agregado por mês e consultas agregadas por categoria.

Ainda não oferece:

- cadastro/tabela de contas e categorias;
- CRUD de lançamentos manuais;
- importação reconciliada por assinatura de lançamento;
- rotas para consultar/editar saldos de contas e saldo aplicado;
- títulos de pagar/receber;
- as rotas de escrita/admin de categorias e empresas;
- a estrutura de dashboard usada pelo desktop.

## 2. Autenticação e permissões

As rotas protegidas recebem `Authorization: Bearer <access_token>`. O usuário precisa existir e estar ativo; caso contrário, a API retorna `401`.

| Método e rota | Acesso | Comportamento e contrato |
|---|---|---|
| `POST /api/auth/login` | Público | Corpo `{ "email": "...", "senha": "..." }`. Retorna `{ "access_token": "...", "token_type": "bearer" }`. Login inválido ou usuário inativo retorna `401`. |
| `GET /api/auth/me` | Logado | Retorna `id`, `nome`, `email`, `role`, `ativo`. |
| `POST /api/auth/trocar-senha` | Logado | Corpo `{ "senha_atual": "...", "nova_senha": "..." }`; nova senha exige pelo menos 8 caracteres. Senha atual incorreta ou senha nova igual à atual retorna `400`. |
| `POST /api/auth/esqueci-senha` | Público | Corpo `{ "email": "..." }`. Resposta não revela se o e-mail existe. O código expira conforme `RESET_TOKEN_MINUTES` (padrão: 30 minutos), é de uso único e há intervalo configurável entre pedidos. |
| `POST /api/auth/redefinir-senha` | Público | Corpo `{ "codigo": "...", "nova_senha": "..." }`. Código inválido, usado ou expirado retorna `400`. |
| `GET /api/usuarios` | Admin | Lista usuários. |
| `POST /api/usuarios` | Admin | Cria usuário com `nome`, `email`, `senha` e `role` (`admin` ou `user`). Retorna `201`; e-mail repetido retorna `409`. |
| `PATCH /api/usuarios/{usuario_id}` | Admin | Altera `nome`, `email`, `role` e/ou `ativo`. E-mail repetido retorna `409`. O admin não pode retirar o próprio acesso de admin. |

Todas as rotas de `/api/usuarios` exigem admin. Usuário desativado não consegue autenticar e tokens dele deixam de funcionar.

**Limite existente:** não há rota administrativa `/api/usuarios/{id}/redefinir-senha`, que o desktop declara no contrato. A proteção contra remover o último admin ativo só impede que o próprio admin autenticado retire o próprio acesso; outro admin pode desativar/rebaixar o último administrador.

## 3. Banco de dados e migrações

O schema atual contém:

- `usuarios`: nome, e-mail único, hash de senha, perfil, ativo e data de criação;
- `reset_senha`: usuário, hash único do código, expiração, uso e criação;
- `empresas`: nome, CNPJ opcional/único e data de criação;
- `importacoes`: usuário, nome do arquivo, data, contagens e status;
- `lancamentos`: importação de origem obrigatória, empresa opcional, competência (`AAAA-MM`), data, banco como texto, tipo, categoria como texto, descrição, observação, documento, código de operação, valor em centavos com sinal e saldo após lançamento opcional;
- `saldos_mensais`: importação de origem obrigatória, competência, banco como texto, saldo inicial e saldo final informado. Há unicidade por competência e banco.

Não há tabelas/modelos `contas`, `categorias` ou `titulos`. `pagamentos` existia na migração inicial, mas é removida por uma migração posterior; não há modelo atual nem rotas substitutas de títulos.

As migrações usam Alembic. A API não chama `create_all()` na inicialização; é necessário executar `alembic upgrade head` antes de iniciar. O seed cria apenas o primeiro admin. O README contém instruções antigas que dizem que o seed cria tabelas.

## 4. Importação de planilha

### Rotas

| Método e rota | Acesso | Comportamento e resposta |
|---|---|---|
| `POST /api/importacoes/previa` | Logado | Multipart com campo `arquivo`. Limite de 10 MB; aceita apenas nome terminado em `.xlsx`. Lê e valida sem gravar e devolve token temporário. |
| `POST /api/importacoes/confirmar` | Logado | Corpo `{ "token": "..." }`. Confirma a prévia do próprio usuário e cria histórico. Token inexistente, expirado, de outro usuário ou já usado retorna `404`. |
| `GET /api/importacoes` | Logado | Histórico mais recente primeiro, com usuário, arquivo, contagens e status. |

O token fica em memória por 30 minutos, é vinculado ao usuário e é de uso único. Uma nova prévia do mesmo usuário invalida a anterior. Reiniciar o processo perde as prévias pendentes; múltiplos workers não compartilham o armazenamento.

### Leitura e validação atual

- Usa pandas/openpyxl; requer uma aba `Base`.
- Colunas obrigatórias: `Mês`, `Data`, `Banco`, `Tipo`, `Discriminação (original)`, `Categoria`, `Valor`.
- Colunas opcionais: `Cód. Op. Ban.`, `Documento`, `Observação`, `Saldo Após Lançamento`.
- Ignora colunas extras e procura cabeçalhos sem depender da ordem. A normalização é `strip()` e minúsculas, mas **não remove acentos**.
- Valida mês no formato `Jan/26` e correspondência entre mês e data; tipos aceitos: `Receita`, `Despesa`, `Investimento`; valor convertido para centavos; bloqueia zero, receita negativa e despesa positiva.
- `Saldo Após Lançamento`, quando presente, é armazenado na linha. Não é usado para derivar automaticamente os saldos mensais.
- A aba `Saldos_Mensais` é opcional e, quando presente, espera `Mês`, `Banco`, `Saldo Inicial` e `Saldo Final Informado`.
- Observação e Documento não são campos obrigatórios na leitura. Não há validação de existência de conta/categoria nem validação da regra de Observação para “Aplicação Financeira”.
- Erros retornam linha, coluna, mensagem e aba; não retornam a linha original (`bruto`) que permita à tela corrigir os dados.

### Confirmação e comportamento de reimportação

A confirmação usa uma transação do banco e faz rollback se a gravação falhar. Porém, **não compara lançamentos por assinatura**:

1. Conta quantos lançamentos já existem nos meses da planilha para apresentar `linhas_substituidas`.
2. Na confirmação, apaga todos os lançamentos das competências válidas presentes no arquivo.
3. Insere as linhas válidas da nova planilha.
4. Se houver saldos válidos na aba `Saldos_Mensais`, substitui os saldos desses meses.
5. Cria o registro de histórico.

Consequências: não há classificação nova/igual/atualizada; reimportar um mês substitui o mês inteiro, inclusive dados que não vieram naquele arquivo; lançamento manual não é suportado; a API não recebe correções feitas na tela, saldos informados nem saldo aplicado. O token é consumido antes da transação do banco, portanto uma falha na gravação exige reenviar o arquivo.

### Formatos relevantes da resposta

`Previa` contém `token`, `arquivo_nome`, `total_linhas`, `linhas_ok`, `linhas_erro`, contagens da aba de saldos, `linhas_substituidas`, `periodos`, `amostra` e `erros`.

Cada erro tem `linha`, `coluna`, `mensagem` e `aba`. A amostra tem `linha`, `data`, `banco`, `categoria`, `tipo`, `descricao`, `valor` em centavos e, opcionalmente, `empresa`.

O histórico retorna `linhas_total`, `linhas_ok`, `linhas_erro` e status (`concluida` ou `concluida_com_erros`). Não retorna contagens de novas/iguais/atualizadas.

## 5. Lançamentos e empresas

### Lançamentos

O backend oferece apenas leitura:

- `GET /api/lancamentos`: exige login; filtros opcionais `banco`, `categoria`, `tipo`, `empresa_id`, `de`, `ate`, `busca`; ordenação por `data`, `valor`, `banco`, `categoria`, `tipo` ou `descricao`; direção `asc`/`desc`; paginação `pagina` (padrão 1) e `tamanho` (padrão 50, máximo 500).
- A busca procura texto em descrição ou observação; totais de receitas/despesas são calculados para todas as linhas filtradas, não só a página.
- `GET /api/lancamentos/filtros`: devolve bancos e categorias existentes nos lançamentos e tipos permitidos.
- `GET /api/lancamentos/categorias`: devolve agregados por categoria sob os filtros da listagem.

A resposta de `GET /api/lancamentos` é `{ itens, total, pagina, tamanho, paginas, totais }`, não uma lista simples. Não há `POST`, `PATCH` ou `DELETE`, e portanto não há cadastro manual nem validação server-side de edição/exclusão. O parâmetro usado para conta é `banco`, não `conta`.

### Empresas

- `GET /api/empresas`: exige login; aceita `busca`, `ordenar_por`, `direcao`, `pagina` e `tamanho`. Retorna `{ itens, total, pagina, tamanho, paginas }`.
- `GET /api/empresas/{empresa_id}`: exige login; retorna empresa agregada e até 1000 lançamentos associados, mais recentes primeiro.

Não há `POST`, `PATCH` ou `DELETE` de empresas. O modelo não tem tipo (`incubada`/`fornecedor`) nem restrição de unicidade no nome. A resposta é paginada e inclui contagens/totais, em vez do formato simples `{ id, nome, tipo, cnpj }` esperado pelo desktop.

## 6. Dashboard atual

`GET /api/dashboard` exige login. Retorna:

- `instituicao` e `atualizado_em` (data/hora da importação mais recente);
- `contas` encontradas nos lançamentos/saldos;
- `meses`: objetos `{ mes, receitas, despesas, aplicacoes, resgates }`;
- `categorias`: objetos `{ categoria, receitas, despesas }`;
- `saldos`: saldos persistidos na tabela `saldos_mensais`, com movimento calculado pelos lançamentos daquele mês/conta.

Valores são centavos. Conciliação calcula `saldo_final = saldo_inicial + entradas + saidas`, e diferença como `saldo_final - saldo_informado`. Status só pode ser `OK` ou `DIVERGÊNCIA`; não existe `NÃO CONFERIDO`.

Classificação atual:

- tipo `Investimento` com valor negativo → aplicação;
- tipo `Investimento` com valor não negativo → resgate;
- categoria `Aplicação Financeira` e tipo `Receita`: se descrição/observação contiver “resgat”, é resgate; caso contrário, é rendimento;
- rendimento é exibido na categoria artificial `Rendimentos de Aplicações`.

Isso difere da regra solicitada para o desktop, que determina a classificação pela categoria, sinal e Observação. A resposta também **não contém** agregação por mês/conta/categoria/movimento, `resumo` ou saldo `aplicado`; `meses` e `categorias` têm formatos diferentes dos tipos do desktop.

## 7. Categorias, saldos e títulos ausentes

Não existem rotas backend para:

- `/api/categorias` (GET/POST/PATCH/DELETE), categoria de sistema ou proteção de categoria em uso;
- `/api/saldos` (GET/PUT), `/api/saldos/aplicado` ou cálculo de saldos para todos os meses/contas;
- `/api/titulos` (GET/POST/PATCH/DELETE), resumo de títulos, validações de vencimento/pagamento ou status/atraso.

O modelo `saldos_mensais` guarda apenas importação, competência, banco, saldo inicial e saldo final informado. Não há origem, saldo opcional, override de aplicado ou cálculo persistido de saldo mensal.

## 8. Erros e formato `detail`

Erros de negócio lançados manualmente com `HTTPException` usam texto em `detail`. Entretanto, não há handler global para erros de validação do FastAPI/Pydantic; respostas `422` de validação padrão podem ter `detail` como lista. Portanto, o requisito de `detail` sempre textual não está garantido.

## 9. E-mail de redefinição

O envio SMTP é configurável por variáveis de ambiente (`SMTP_HOST`, porta, segurança, usuário, senha e remetente). Com `SMTP_HOST` vazio, o código de redefinição é impresso no console para desenvolvimento. A integração é SMTP genérica; não está configurada especificamente para uma conta Gmail institucional.

## 10. Testes existentes e limites

Há testes automatizados para importações e dashboard, incluindo prévia, erros, histórico, substituição de meses, saldos importados e agregações atuais. As fixtures são montadas nos testes; não documentam o teste da planilha real anonimizada de 18/18 exigido para a nova regra. Não há cobertura que comprove CRUD manual de lançamentos, categorias, títulos, edição de saldos, permissões para as rotas ausentes, `detail` textual em todos os 422 ou a resposta completa esperada pelo desktop.

## 11. Principais incompatibilidades com o desktop

1. O desktop espera prévia classificada em novas/iguais/atualizadas, `bruto` nos erros e confirmação com correções/saldos/aplicado; o backend usa contagens diferentes e confirmação só com token.
2. O desktop espera CRUD de lançamentos e resposta simples/lista; o backend oferece somente GET paginado.
3. O desktop espera categorias, CRUD/criação de empresas, saldos e títulos; várias dessas rotas não existem.
4. A listagem de empresas do backend é paginada e não inclui o `tipo` esperado pelo front.
5. O dashboard tem estrutura e regra de classificação diferentes do contrato TypeScript.
6. O front só exibe `detail` se for texto; erros de validação 422 do FastAPI podem não satisfazer isso.

## 12. Arquivos-fonte de referência

- `app/main.py`: registro de routers e indicação de migração Alembic.
- `app/models.py`, `app/schemas.py`: tabelas e formatos de request/response.
- `app/api/`: rotas de autenticação, usuários, importações, lançamentos, empresas e dashboard.
- `app/services/planilha.py`, `previas.py`, `dashboard.py`, `consultas.py`: lógica de leitura, token, agregação e filtros.
- `alembic/versions/`: histórico do schema.
- `tests/test_importacoes.py`, `tests/test_dashboard.py`: cobertura automatizada existente.
