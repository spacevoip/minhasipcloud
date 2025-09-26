# CapRover Deploy Guide

## Estrutura do Projeto

Este projeto está configurado para deploy no CapRover usando microserviços separados:

### Frontend (Next.js)
- **App Name**: `pabx-frontend`
- **Path**: Raiz do repositório
- **Config**: `captain-definition` (Node.js 20)
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### Backend (Express.js)
- **App Name**: `pabx-backend`
- **Path**: `/backend` folder
- **Config**: `backend/captain-definition` (Node.js 20)
- **Build Command**: `npm install`
- **Start Command**: `npm start`

## Deploy Steps

### 1. Frontend Deploy
```bash
# No CapRover, criar app: pabx-frontend
# Conectar ao repositório: branch main, path: /
# O CapRover vai usar o captain-definition da raiz
```

### 2. Backend Deploy
```bash
# No CapRover, criar app: pabx-backend
# Conectar ao repositório: branch main, path: /backend
# O CapRover vai usar o captain-definition do backend
```

## Variáveis de Ambiente

### Frontend (pabx-frontend)
```
NEXT_PUBLIC_API_URL=https://pabx-backend.your-domain.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_WSS_DOMAIN=wss://your-asterisk:8089/ws
NEXT_PUBLIC_MATOMO_URL=your_matomo_url
NEXT_PUBLIC_MATOMO_SITE_ID=1
```

### Backend (pabx-backend)
```
NODE_ENV=production
PORT=3000
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
AMI_HOST=your_asterisk_host
AMI_PORT=5038
AMI_USERNAME=your_ami_user
AMI_SECRET=your_ami_secret
```

## SSL & Domains

1. **Frontend**: Configure custom domain (ex: `app.yourdomain.com`)
2. **Backend**: Configure custom domain (ex: `api.yourdomain.com`)
3. **SSL**: CapRover configura automaticamente via Let's Encrypt

## Monitoring

- **Logs**: Disponíveis no painel do CapRover
- **Metrics**: CPU, RAM, Network por app
- **Health Checks**: Configure endpoints de health

## Scaling

- **Frontend**: Pode escalar horizontalmente
- **Backend**: Pode escalar horizontalmente
- **Database**: Configure separadamente (PostgreSQL, MySQL, etc.)
