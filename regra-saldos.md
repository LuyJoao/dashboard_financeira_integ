# Regra dos saldos (para o back-end)

Objetivo: ninguém precisa digitar o saldo das contas. O sistema lê do extrato ou calcula.

## 1. Saldo das contas, na importação (lido do extrato)

A planilha tem a coluna **"Saldo Após Lançamento"**: o saldo que o banco mostra depois de cada linha.
Para cada par (conta, mês):

- **saldo final** = "Saldo Após Lançamento" da **última** linha do mês na conta;
- **saldo inicial** = "Saldo Após Lançamento" da **primeira** linha do mês **menos o valor dessa linha**.

Ordem das linhas: a do arquivo (o extrato é cronológico). Em empate de data, vale a ordem do arquivo.

Testado com a planilha real: **18 de 18** meses/contas batem com os saldos que a supervisora digitava (inicial e final).

- Mês em que a conta **não tem linhas**: saldo inicial = saldo final = saldo final do mês anterior.
- Linha **sem** "Saldo Após Lançamento": não derivar. Devolver `null` e o usuário digita (`lido_do_extrato: false`).
- Não corrigir descontinuidades entre o fim de um mês e o início do seguinte (ex.: R$ 1,00 do Itaú entre fev e mar). Manter como veio.

## 2. Conciliação

Para cada (conta, mês):

- `saldo_calculado = saldo_inicial + entradas + saídas`, somando **todos** os lançamentos do sistema no mês e conta (importados e manuais);
- `diferenca = saldo_calculado - saldo_do_extrato`;
- `status`: `OK` se zero; `DIVERGÊNCIA` se diferente de zero; **`NÃO CONFERIDO`** se não existe saldo do extrato.

Lançamento manual em mês que já tem saldo do extrato muda o saldo calculado e gera `DIVERGÊNCIA` até alguém ajustar. É esperado.

## 3. Mês com lançamentos só manuais (sem importação)

- `saldo_inicial` = saldo final do mês anterior (do extrato ou calculado);
- `saldo_final` = calculado; `saldo_informado` = o mesmo valor; `status = NÃO CONFERIDO`;
- criar a linha para **todas** as contas (as sem movimento repetem o saldo do mês anterior), senão o saldo total do mês fica errado;
- o usuário pode, depois, informar o saldo do banco (opcional): a conciliação passa a valer.

## 4. Saldo aplicado

O extrato da conta mostra só a saída ao aplicar e a entrada ao resgatar. Por isso o saldo aplicado é **calculado**:

- mês m: `inicial` = final do mês m−1; `final` = `inicial` − soma dos valores da categoria "Aplicação Financeira" cuja Observação **não** é "Rendimento"
  (aplicação é negativa, resgate é positivo);
- primeiro mês: saldo aplicado inicial = 0, ou o valor informado;
- o usuário pode **sobrescrever** com o saldo real do investimento (opcional); a partir dali o calculado segue desse valor.

Em aberto com a supervisora: se o rendimento do investimento é creditado na conta ou fica dentro do investimento. Se ficar dentro,
o saldo real é maior que o calculado e só o extrato da aplicação mostra isso.

## 5. Resultado do mês

`resultado = (soma dos saldos finais das contas + aplicado final) - (soma dos saldos iniciais das contas + aplicado inicial)`

Receitas, despesas, rendimentos, aplicações e resgates continuam vindo dos lançamentos (linhas separadas).
