# Configuração de Variáveis de Ambiente

## Supabase Configuration

Para configurar o Supabase, adicione as seguintes variáveis no seu arquivo `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://db.minhasip.cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU2MzMyMDAwLCJleHAiOjE5MTQwOTg0MDB9.vIiIgvpXc1MPG7skoG1w3eYDQbWY-BL6CDJvAzwl6SA
```

## Como usar

1. Crie um arquivo `.env.local` na raiz do projeto
2. Adicione as variáveis acima
3. Reinicie o servidor de desenvolvimento

## Benefícios

- ✅ **Segurança**: Credenciais não ficam hardcoded no código
- ✅ **Flexibilidade**: Fácil mudança entre ambientes (dev/prod)
- ✅ **Versionamento**: Arquivo `.env.local` não vai para o Git
- ✅ **Configuração centralizada**: Todas as configs em um lugar

## Fallback

O código mantém valores padrão caso as variáveis não estejam definidas, mas exibirá warnings no console.
