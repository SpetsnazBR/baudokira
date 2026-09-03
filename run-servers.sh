#!/bin/bash

# Script para executar o servidor do projeto Baú do Kira
# Este script inicia o servidor do Astro Blog

set -e  # Exit on error

# Função de ajuda
show_help() {
    echo "Uso: $0 [OPÇÃO]"
    echo ""
    echo "Script para executar o servidor do projeto Baú do Kira"
    echo ""
    echo "Opções:"
    echo "  -h, --help     Mostra esta mensagem de ajuda"
    echo "  -v, --version  Mostra a versão do script"
    echo "  --no-check     Executa sem verificar dependências"
    echo ""
    echo "Exemplos:"
    echo "  $0              # Executa com todas as verificações"
    echo "  $0 --no-check   # Executa sem verificar dependências"
    echo ""
    exit 0
}

# Função de versão
show_version() {
    echo "run-servers.sh v2.1.0"
    echo "Script para executar o servidor do Baú do Kira"
    exit 0
}

# Processar argumentos
NO_CHECK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        -v|--version)
            show_version
            ;;
        --no-check)
            NO_CHECK=true
            shift
            ;;
        *)
            echo "Erro: Argumento desconhecido: $1"
            echo "Use $0 --help para ver as opções disponíveis"
            exit 1
            ;;
    esac
done

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_message() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

# Função para limpar processos ao sair
cleanup() {
    print_message "Encerrando servidor..."

    if [ -n "$ASTRO_PID" ]; then
        print_message "Parando servidor Astro (PID: $ASTRO_PID)..."
        kill $ASTRO_PID 2>/dev/null || true
    fi

    print_success "Servidor encerrado."
    exit 0
}

# Configurar trap para capturar sinais de saída
trap cleanup SIGINT SIGTERM EXIT

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    print_error "Node.js não encontrado. Por favor, instale Node.js 22.12+."
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    print_error "npm não encontrado. Por favor, instale npm."
    exit 1
fi

print_message "========================================="
print_message "Iniciando servidor do Baú do Kira"
print_message "========================================="

# Verificar se as dependências estão instaladas (a menos que --no-check seja usado)
if [ "$NO_CHECK" = false ]; then
    print_message "Verificando dependências..."

    # Verificar dependências do projeto principal
    if [ ! -d "node_modules" ]; then
        print_warning "Dependências do projeto não encontradas."
        read -p "Deseja instalar as dependências? (s/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            print_message "Instalando dependências do projeto..."
            npm install
            print_success "Dependências do projeto instaladas."
        else
            print_warning "Continuando sem instalar dependências..."
        fi
    fi
else
    print_warning "Pulando verificação de dependências (--no-check)"
fi

# Iniciar servidor Astro Blog
print_message "Iniciando servidor Astro Blog (porta 3334)..."
npm run dev &
ASTRO_PID=$!

sleep 2  # Dar tempo para o servidor iniciar
if kill -0 $ASTRO_PID 2>/dev/null; then
    print_success "Servidor Astro iniciado (PID: $ASTRO_PID)"
    print_success "Blog disponível em: http://localhost:3334"
else
    print_error "Falha ao iniciar servidor Astro"
    exit 1
fi

print_message "========================================="
print_success "Servidor está rodando!"
print_message "========================================="
print_message "Servidores:"
print_message "  • Astro Blog: http://localhost:3334"
print_message ""
print_message "Pressione Ctrl+C para encerrar o servidor"
print_message "========================================="

# Manter o script rodando
wait
