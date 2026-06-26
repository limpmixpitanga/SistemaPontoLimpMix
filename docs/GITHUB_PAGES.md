# Publicacao no GitHub Pages

Este projeto nao precisa de servidor, Python ou banco SQLite.

Arquivos essenciais:

- `index.html`
- `assets/`
- `data/`
- `.nojekyll`

## Configurar Pages

No GitHub:

1. Abra `Settings`.
2. Abra `Pages`.
3. Selecione `Deploy from a branch`.
4. Selecione branch `main`.
5. Selecione pasta `/root`.
6. Salve.

## Atualizar dados publicados

No sistema, entre como MASTER e use `Dados e backup`.

Para atualizar a base do site:

1. Baixe `cadastros.json`.
2. Baixe `registros.json`.
3. Substitua os arquivos em `data/`.
4. Envie a alteracao para o GitHub.

## Limite tecnico

GitHub Pages nao salva alteracoes nos arquivos JSON do repositorio.
As alteracoes feitas pelo usuario ficam no `localStorage` do navegador ate serem exportadas.

Para manter cadastro e batidas unicos entre navegadores, use o backend em:

`scripts/google-apps-script-backend.gs`

Depois de publicar o Apps Script como App da Web, configure a URL em:

`data/cadastros.json > configuracoes.syncEndpoint`

O mesmo Apps Script tambem cria/atualiza uma Planilha Google na pasta do Drive configurada no script. A planilha se chama `Sistema Ponto LimpMix - Registros` e mostra as abas `Funcionarios`, `Registros`, `Logs` e `Resumo`.
