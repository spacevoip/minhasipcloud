#!/bin/bash

# =====================================================
# PABX SYSTEM - Docker Startup Script
# Gerencia containers Docker do sistema PABX
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker não está rodando. Por favor, inicie o Docker primeiro."
        exit 1
    fi
    log_success "Docker está rodando"
}

# Check if docker-compose is available
check_compose() {
    if command -v docker-compose > /dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version > /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        log_error "Docker Compose não encontrado. Instale docker-compose ou use Docker Desktop."
        exit 1
    fi
    log_success "Docker Compose disponível: $COMPOSE_CMD"
}

# Build and start containers
start_containers() {
    log_info "🚀 Iniciando containers do Sistema PABX..."
    
    # Build images
    log_info "🔨 Building images..."
    $COMPOSE_CMD build --no-cache
    
    # Start services
    log_info "🏃 Iniciando serviços..."
    $COMPOSE_CMD up -d
    
    # Wait for services to be healthy
    log_info "⏳ Aguardando serviços ficarem prontos..."
    sleep 10
    
    # Check service status
    check_services
}

# Check if services are running
check_services() {
    log_info "🔍 Verificando status dos serviços..."
    
    # Check Redis
    if $COMPOSE_CMD ps redis | grep -q "Up"; then
        log_success "Redis: Rodando"
    else
        log_error "Redis: Falhou ao iniciar"
    fi
    
    # Check Backend
    if $COMPOSE_CMD ps backend | grep -q "Up"; then
        log_success "Backend: Rodando"
    else
        log_error "Backend: Falhou ao iniciar"
    fi
    
    # Check Frontend
    if $COMPOSE_CMD ps frontend | grep -q "Up"; then
        log_success "Frontend: Rodando"
    else
        log_error "Frontend: Falhou ao iniciar"
    fi
}

# Show service URLs
show_urls() {
    echo ""
    log_success "🎉 Sistema PABX iniciado com sucesso!"
    echo ""
    echo "📱 Frontend:     http://localhost:3000"
    echo "🔧 Backend API:  http://localhost:3001"
    echo "🔁 Transfer:     http://localhost:3209"
    echo "💾 Redis:        localhost:6379"
    echo ""
    log_info "Para parar: ./docker-start.sh stop"
    log_info "Para logs:  ./docker-start.sh logs"
    echo ""
}

# Stop containers
stop_containers() {
    log_info "🛑 Parando containers..."
    $COMPOSE_CMD down
    log_success "Containers parados"
}

# Show logs
show_logs() {
    log_info "📋 Mostrando logs dos containers..."
    $COMPOSE_CMD logs -f
}

# Restart containers
restart_containers() {
    log_info "🔄 Reiniciando containers..."
    $COMPOSE_CMD restart
    check_services
    show_urls
}

# Clean up everything
cleanup() {
    log_warning "🧹 Limpando containers, volumes e imagens..."
    $COMPOSE_CMD down -v --rmi all
    log_success "Limpeza concluída"
}

# Main script logic
case "${1:-start}" in
    "start")
        check_docker
        check_compose
        start_containers
        show_urls
        ;;
    "stop")
        check_compose
        stop_containers
        ;;
    "restart")
        check_compose
        restart_containers
        ;;
    "logs")
        check_compose
        show_logs
        ;;
    "status")
        check_compose
        check_services
        ;;
    "clean")
        check_compose
        cleanup
        ;;
    "help"|"-h"|"--help")
        echo "🐳 PABX System Docker Manager"
        echo ""
        echo "Uso: $0 [comando]"
        echo ""
        echo "Comandos:"
        echo "  start    - Inicia todos os containers (padrão)"
        echo "  stop     - Para todos os containers"
        echo "  restart  - Reinicia todos os containers"
        echo "  logs     - Mostra logs em tempo real"
        echo "  status   - Verifica status dos serviços"
        echo "  clean    - Remove containers, volumes e imagens"
        echo "  help     - Mostra esta ajuda"
        echo ""
        ;;
    *)
        log_error "Comando inválido: $1"
        log_info "Use '$0 help' para ver comandos disponíveis"
        exit 1
        ;;
esac
