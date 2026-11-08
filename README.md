# Controle Financeiro do Casal

Aplicação web progressiva (PWA) para registrar receitas, despesas, metas, parcelamentos, recorrências e orçamento por categoria. Os dados ficam armazenados apenas no navegador, sem envio para servidores.

## Uso

1. Sirva os arquivos por HTTP ou HTTPS, por exemplo:
   ```bash
   python3 -m http.server 8080
   ```
2. Abra `http://localhost:8080`.
3. Cadastre lançamentos ou importe um backup.

## Recursos

- Saldo, receitas e despesas por mês.
- Filtros, edição, exclusão, parcelamento e recorrência mensal.
- Gráficos acessíveis, calendário e resumo anual.
- Categorias com orçamento mensal.
- Metas financeiras.
- Desfazer das últimas 20 alterações.
- Backup JSON, exportação CSV e importação CSV/OFX.
- Tema claro, tema escuro e funcionamento offline.

## Formatos de importação

### CSV

O cabeçalho pode usar `Data`, `Descrição`, `Tipo`, `Categoria`, `Quem` e `Valor`. Datas são aceitas nos formatos `YYYY-MM-DD` e `DD/MM/YYYY`; valores podem usar vírgula ou ponto como separador decimal.

### JSON

O backup gerado pelo botão **Backup JSON** pode ser restaurado pelo botão **Restaurar backup**.

## Privacidade e armazenamento

Os registros usam o armazenamento local do navegador (`localStorage`). Trocar de navegador, limpar os dados do site ou apagar o perfil do navegador pode remover os lançamentos. Faça backups regularmente.

## Estrutura

- `index.html`: interface.
- `styles.css`: layout e responsividade.
- `app.js`: estado, cálculos, importação e renderização.
- `sw.js`: cache offline.
- `manifest.webmanifest`: instalação como aplicativo.
