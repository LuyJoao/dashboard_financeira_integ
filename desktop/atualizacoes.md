# Atualização automática do aplicativo

Os computadores com o aplicativo instalado verificam, ao abrir e a cada 4 horas, se há uma versão nova no
servidor da empresa. Se houver, baixam em segundo plano e perguntam se querem reiniciar para instalar
(se escolherem "Depois", a instalação acontece quando fecharem o aplicativo).

## Como publicar uma versão nova

1. **Suba o número da versão** em `desktop/package.json` (ex.: `0.2.0` para `0.2.1`). A atualização só
   acontece para uma versão **maior**. Nunca reutilize um número já publicado.
2. Confira `desktop/.env`: `VITE_API_URL` deve apontar para a API do servidor (o endereço fica gravado no instalador).
3. Gere o instalador: `npm run electron:build`.
4. Em `desktop/release/`, copie **os três arquivos** abaixo para a pasta `backend/atualizacoes/` do servidor:
   - `Pagamentos Setup X.Y.Z.exe`
   - `Pagamentos Setup X.Y.Z.exe.blockmap`
   - `latest.yml`  (é ele que diz qual é a versão mais nova)
5. Pronto. Quem abrir o aplicativo recebe a atualização.

## Servidor de atualizações

O back-end já serve `backend/atualizacoes/` como arquivos estáticos em `/atualizacoes`.
Essa pasta está ignorada pelo Git para que instaladores e atualizações não sejam publicados no repositório.
Restrinja a escrita nessa pasta às pessoas responsáveis por publicar versões.

O endereço de publicação (`build.publish.url` em `desktop/package.json`) deve ser
`http://IP_DO_SERVIDOR:8000/atualizacoes`, o mesmo servidor da API, e é gravado no instalador no momento do build.
O valor `http://localhost:8000/atualizacoes` do projeto serve apenas para desenvolvimento: em cada computador instalado,
`localhost` aponta para o próprio computador. Troque-o pelo endereço real do servidor junto com `VITE_API_URL` antes de gerar o instalador.

## Primeira instalação

Quem já tem uma versão **sem** atualização automática (a 0.1.0) precisa instalar a nova **uma vez, à mão**.
Dali em diante as atualizações chegam sozinhas.

## Como testar

1. Instale a versão `0.2.0` em um computador.
2. Publique a `0.2.1` (passos acima).
3. Abra o aplicativo na máquina com a `0.2.0`: em instantes aparece "Atualização pronta".

Se não aparecer: abra `http://IP_DO_SERVIDOR:8000/atualizacoes/latest.yml` em um navegador (deve mostrar o arquivo)
e confira se a versão dele é maior que a instalada.

## Segurança: leia antes de usar fora da rede interna

- A atualização usa **HTTP** e o instalador **não é assinado**. O `latest.yml` traz o código (sha512) do instalador,
  mas como os dois vêm do mesmo servidor sem criptografia, quem controlasse a rede poderia trocar ambos.
  Para uma rede interna pequena e confiável isso é aceitável. Para qualquer uso fora dela, serão necessários
  HTTPS e um certificado de assinatura de código.
- Mantenha a pasta `atualizacoes` com permissão de escrita só para quem publica versões.
- Para voltar atrás: publique uma versão **maior** com o código antigo. Apagar arquivos não desinstala nada.
