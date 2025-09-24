#!/bin/bash

# =====================================================
# PABX SYSTEM - Script de Inicialização
# Inicia Frontend (Next.js) + Backend (Node.js) simultaneamente
# =====================================================

echo "🚀 Iniciando Sistema PABX..."
echo "📦 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo ""

# ======================
# ARI Health Check func
# ======================
check_ari() {
    # Allow override via env, fallback to provided sample
    local ARI_BASE_URL_VAR=${ARI_BASE_URL:-http://69.62.103.45:8088}
    local ARI_USER_VAR=${ARI_USER:-admin}
    local ARI_PASSWORD_VAR=${ARI_PASSWORD:-35981517}

    local URL="$ARI_BASE_URL_VAR/ari/channels"
    echo "📡 Testando conexão com ARI: $URL"

    # Perform request with 5s timeout
    local HTTP_CODE
    HTTP_CODE=$(curl -sS -u "$ARI_USER_VAR:$ARI_PASSWORD_VAR" -m 5 -w "%{http_code}" "$URL" -o /tmp/ari_resp.json || echo "000")

    if [ "$HTTP_CODE" != "200" ]; then
        echo "❌ ARI indisponível (HTTP $HTTP_CODE). Verifique ARI_BASE_URL/USER/PASSWORD"
        return 1
    fi

    # Basic validation of JSON array and count (best-effort without jq)
    local COUNT
    COUNT=$(grep -o '"id"' /tmp/ari_resp.json | wc -l | tr -d ' ')
    echo "✅ ARI online! Canais ativos: ${COUNT}"

    # Cleanup temp file
    rm -f /tmp/ari_resp.json 2>/dev/null
    return 0
}

# Função para matar processos em uma porta específica
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        echo "🔄 Finalizando processos na porta $port..."
        kill -9 $pids 2>/dev/null
        sleep 1
        echo "✅ Porta $port liberada"
    fi
}

# Função para limpar processos ao sair
cleanup() {
    echo ""
    echo "🛑 Parando serviços..."
    kill $(jobs -p) 2>/dev/null
    kill_port 3000
    kill_port 3001
    kill_port 3209
    exit
}

# Capturar Ctrl+C para cleanup
trap cleanup SIGINT

# Verificar se as pastas existem
if [ ! -d "backend" ]; then
    echo "❌ Pasta 'backend' não encontrada!"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ package.json do frontend não encontrado!"
    exit 1
fi

# Limpar portas antes de iniciar
echo "🧹 Verificando e limpando portas..."
kill_port 3001
kill_port 3000
kill_port 3209
echo ""

# Iniciar Backend em background
echo "🔧 Iniciando Backend (porta 3001)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Iniciar Transfer Service em background
echo "🔁 Iniciando Transfer Service (porta 3209)..."
node backend/transfer-server.js &
TRANSFER_PID=$!

# Aguardar 3 segundos para backend inicializar
sleep 3

# Checar ARI (não bloqueante para o sistema, apenas informativo)
echo ""
echo "🧪 Executando health check do ARI..."
check_ari || echo "⚠️  Prosseguindo mesmo com falha no ARI (somente aviso)"

# Iniciar Frontend em background
echo "📦 Iniciando Frontend (porta 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Sistema iniciado com sucesso!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "🔁 Transfer Service: http://localhost:3209"
echo "💾 Redis Cache: Ativo"
echo ""
echo "⚠️  Pressione Ctrl+C para parar ambos os serviços"
echo ""

# Aguardar os processos
wait
