#!/bin/bash

# =====================================================
# SCRIPT DE LIMPEZA PARA PRODUÇÃO - PABX SYSTEM
# Remove arquivos de teste, debug e desenvolvimento
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_info "🧹 Iniciando limpeza para produção..."

# Contador de arquivos removidos
removed_count=0

# Função para remover arquivo se existir
remove_if_exists() {
    if [ -f "$1" ]; then
        rm "$1"
        log_success "Removido: $1"
        ((removed_count++))
    fi
}

# Remover arquivos de teste do backend
log_info "🔍 Removendo arquivos de teste do backend..."
remove_if_exists "backend/test-counts.js"
remove_if_exists "backend/test-phone-format.js"
remove_if_exists "backend/test-redis-cloud.js"
remove_if_exists "backend/test-redis.js"
remove_if_exists "backend/test-sms-send.js"
remove_if_exists "backend/test-sms.js"
remove_if_exists "backend/testami.js"
remove_if_exists "backend/testeami.js"
remove_if_exists "backend/testredis.js"
remove_if_exists "backend/testsms.js"

# Remover arquivos de teste da raiz
log_info "🔍 Removendo arquivos de teste da raiz..."
remove_if_exists "test-password.js"
remove_if_exists "test-reseller-plans.js"
remove_if_exists "test-suspend-user.js"
remove_if_exists "testpg.js"

# Remover arquivos de análise e debug
log_info "🔍 Removendo arquivos de análise..."
remove_if_exists "backend/redis-free-tier-analysis.js"
remove_if_exists "backend/redis-scalability-analysis.js"
remove_if_exists "backend/cache-flow-demo.js"
remove_if_exists "backend/setup-redis.js"
remove_if_exists "backend/verify-cache.js"
remove_if_exists "backend/verify-cache-auth.js"
remove_if_exists "check-ps-contacts.js"
remove_if_exists "check-wilson-user.js"

# Remover arquivos backup e broken
log_info "🔍 Removendo arquivos backup e broken..."
find . -name "*.backup" -type f -delete 2>/dev/null || true
find . -name "*.bak" -type f -delete 2>/dev/null || true
find . -name "*-broken.*" -type f -delete 2>/dev/null || true
find . -name "*-old.*" -type f -delete 2>/dev/null || true
find . -name "page-broken.*" -type f -delete 2>/dev/null || true
find . -name "page-old.*" -type f -delete 2>/dev/null || true

# Remover logs de desenvolvimento
log_info "🔍 Removendo logs de desenvolvimento..."
find . -name "*.log" -type f -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name "debug.log" -type f -delete 2>/dev/null || true
find . -name "error.log" -type f -delete 2>/dev/null || true

# Remover arquivos temporários
log_info "🔍 Removendo arquivos temporários..."
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.temp" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
find . -name "Thumbs.db" -type f -delete 2>/dev/null || true

# Limpar cache Next.js
if [ -d ".next" ]; then
    log_info "🔍 Limpando cache Next.js..."
    rm -rf .next
    log_success "Cache Next.js limpo"
fi

# Limpar node_modules de desenvolvimento (opcional)
if [ "$1" = "--deep" ]; then
    log_warning "🧹 Limpeza profunda: removendo node_modules..."
    rm -rf node_modules
    rm -rf backend/node_modules
    log_success "node_modules removidos"
fi

log_success "🎉 Limpeza concluída!"
log_info "📊 Total de arquivos removidos: $removed_count"
log_info "💡 Para limpeza profunda (remove node_modules): ./cleanup-production.sh --deep"

# Mostrar arquivos restantes que podem precisar de atenção
log_info "🔍 Verificando arquivos que podem precisar de atenção..."
find . -name "console.log*" -type f -not -path "./node_modules/*" 2>/dev/null || true
find . -name "*debug*" -type f -not -path "./node_modules/*" -not -name "*.md" 2>/dev/null || true

log_success "✨ Sistema pronto para produção!"
