# Sistema Ponto LimpMix

Projeto estatico para publicar no GitHub Pages.

Repositorio previsto:

https://github.com/limpmixpitanga/SistemaPontoLimpMix

## Como abrir

Abra `index.html` ou publique no GitHub Pages.

Primeiro acesso:

- Usuario: `master`
- Senha: `master123`

## Dados

Arquivos base:

- `data/cadastros.json`
- `data/registros.json`

Importante: GitHub Pages e um site estatico. Ele nao consegue gravar diretamente nos arquivos `data/*.json`.
Por isso, o sistema carrega os JSON iniciais e salva as alteracoes no navegador usando `localStorage`.

No menu MASTER `Dados e backup`, use:

- `Exportar backup JSON` para baixar todos os dados atuais.
- `Baixar cadastros.json` e `Baixar registros.json` para substituir os arquivos da pasta `data` quando quiser publicar uma base atualizada.
- `Importar backup JSON` para restaurar dados no navegador.

## Permissoes

Funcionario:

- Acessa somente `Bater ponto`.
- Ve seus proprios registros recentes na mesma tela.

MASTER:

- Painel administrativo.
- Cadastro de funcionarios.
- Edicao de batidas registradas.
- Justificativas.
- Relatorios.
- Backup/importacao/exportacao.
- Auditoria.

## Backup semanal no Drive

O site estatico nao consegue enviar arquivos automaticamente para Google Drive sem backend/OAuth.
Foi criado um backup local agendavel para a pasta sincronizada do Google Drive no Windows.

Scripts:

- `scripts/backup-semanal.ps1`
- `scripts/instalar-backup-semanal.bat`

Padrao usado:

- Origem: `data`
- Destino: `D:\Documents\BACKUP Meu Drive\SistemaPontoLimpMix`
- Agenda: sabado, 13h

Execute `scripts\instalar-backup-semanal.bat` como Administrador para criar a tarefa semanal.

Se o Google Drive Desktop estiver sincronizando essa pasta com o Drive, os backups irao para a nuvem.
Se a pasta do Drive for outra, edite a variavel `$DestinoDrive` em `scripts/backup-semanal.ps1`.

## Publicacao no GitHub Pages

1. Crie ou abra o repositorio `limpmixpitanga/SistemaPontoLimpMix`.
2. Envie todos os arquivos desta pasta para a branch principal.
3. Em `Settings > Pages`, configure:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
4. A pagina ficara disponivel no endereco informado pelo GitHub Pages.

