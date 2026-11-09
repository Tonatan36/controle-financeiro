# Controle Financeiro do Casal

Aplicação web progressiva (PWA) para registrar receitas, despesas, metas, parcelamentos, recorrências e orçamento por categoria. O app funciona offline com dados locais e pode sincronizá-los com Turso pela API hospedada no Vercel.

## Uso

1. Para usar apenas no dispositivo, sirva os arquivos por HTTP ou HTTPS, por exemplo:
   ```bash
   python3 -m http.server 8080
   ```
2. Abra `http://localhost:8080`.
3. Cadastre lançamentos ou importe um backup.

Esse servidor local não inclui a API de sincronização. Para sincronizar entre dispositivos, publique o projeto no Vercel e configure as variáveis de ambiente indicadas abaixo.

## Recursos

- Saldo, receitas e despesas por mês.
- Filtros, edição, exclusão e recorrência mensal.
- Despesas à vista com conta de origem ou parceladas no cartão; o valor total é dividido automaticamente entre as parcelas.
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

Os registros são armazenados no IndexedDB do navegador. Na primeira abertura, os dados salvos anteriormente em `localStorage` são migrados automaticamente. Ao conectar à nuvem, os dados são enviados à API do Vercel e armazenados no Turso. A senha compartilhada fica apenas na sessão da aba; o token do Turso fica no servidor e nunca deve ser colocado no código do navegador. Faça backups regularmente.

## Sincronização com Turso e Vercel

1. No Turso, crie um token de autenticação para o banco e copie a URL do banco.
2. Importe este repositório como projeto no Vercel.
3. Nas configurações do projeto Vercel, adicione estas variáveis para o ambiente **Production**:
   - `TURSO_DATABASE_URL`: `libsql://controle-financeiro-casal-tonatan36.aws-sa-east-1.turso.io`.
   - `TURSO_AUTH_TOKEN`: token criado no Turso. Mantenha-o privado.
   - `SYNC_PASSWORD`: senha forte compartilhada entre as pessoas que usarão o app.
4. Faça um novo deploy depois de salvar as variáveis.
5. Abra o endereço do Vercel e clique em **Sincronizar** em cada dispositivo. Digite a mesma `SYNC_PASSWORD`.

A tabela de sincronização é criada automaticamente na primeira chamada à API. Na primeira conexão, lançamentos e metas são combinados por ID; depois disso, alterações de outro dispositivo são detectadas pela revisão do banco para evitar sobrescrever dados silenciosamente. As alterações são enviadas quando você salva; para receber alterações feitas no outro dispositivo, clique em **Sincronizar** nele. Se houver conflito, o app permite carregar a versão da nuvem ou, após confirmação, enviar a versão local. Faça backup antes de substituir dados.

O app continua salvando no dispositivo quando está offline, mas essas alterações não chegam à nuvem até haver conexão. GitHub Pages ou um servidor estático local não executam a API; a sincronização exige o deploy no Vercel com as três variáveis configuradas.

## Estrutura

- `index.html`: interface.
- `styles.css`: layout e responsividade.
- `app.js`: estado, cálculos, importação e renderização.
- `indexeddb.js`: conexão e persistência dos dados no IndexedDB.
- `api/sync.js`: API protegida que lê e grava a cópia sincronizada no Turso.
- `sw.js`: cache offline.
- `manifest.webmanifest`: instalação como aplicativo.
