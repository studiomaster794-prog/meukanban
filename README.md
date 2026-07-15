# TaskFlow Pro

Aplicativo completo de gerenciamento de tarefas com visual futurista, glassmorphism, dashboard, calendario, Kanban, estatisticas, gamificacao, backup local e integracao Supabase pronta para ativar.

## Como abrir

Execute:

```powershell
node preview-server.mjs
```

Depois acesse:

```text
http://localhost:4173
```

## Supabase

1. Crie um projeto no Supabase.
2. Execute o arquivo `supabase-schema.sql` no SQL Editor.
3. Em `src/config.js`, preencha:

```js
export const SUPABASE_URL = "https://seu-projeto.supabase.co";
export const SUPABASE_ANON_KEY = "sua-chave-anon";
```

O app mantem funcionamento local instantaneo com `localStorage` e passa a usar autenticacao, cadastro, recuperacao de senha e sincronizacao quando as chaves forem configuradas.

## Atalhos

- `N`: nova tarefa
- `/`: busca
- `Ctrl + Z`: desfazer exclusao recente
