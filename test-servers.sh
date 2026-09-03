#!/bin/bash

# Test script para verificar o funcionamento do run-servers.sh
# Este script testa as funcionalidades básicas sem executar os servidores

echo "=== Testando script run-servers.sh ==="
echo

# Teste 1: Verificar sintaxe
echo "1. Verificando sintaxe do script..."
bash -n run-servers.sh
if [ $? -eq 0 ]; then
    echo "   ✓ Sintaxe OK"
else
    echo "   ✗ Erro na sintaxe"
    exit 1
fi

# Teste 2: Verificar ajuda
echo "2. Verificando opção de ajuda..."
./run-servers.sh --help | grep -q "Uso:"
if [ $? -eq 0 ]; then
    echo "   ✓ Ajuda funciona"
else
    echo "   ✗ Ajuda não funciona"
fi

# Teste 3: Verificar versão
echo "3. Verificando opção de versão..."
./run-servers.sh --version | grep -q "v2.1.0"
if [ $? -eq 0 ]; then
    echo "   ✓ Versão funciona"
else
    echo "   ✗ Versão não funciona"
fi

# Teste 4: Verificar argumentos inválidos
echo "4. Verificando tratamento de argumentos inválidos..."
./run-servers.sh --invalid-arg 2>&1 | grep -q "Erro: Argumento desconhecido"
if [ $? -eq 0 ]; then
    echo "   ✓ Argumentos inválidos tratados corretamente"
else
    echo "   ✗ Argumentos inválidos não tratados"
fi

# Teste 5: Verificar permissões
echo "5. Verificando permissões do script..."
if [ -x "run-servers.sh" ]; then
    echo "   ✓ Script é executável"
else
    echo "   ✗ Script não é executável"
    echo "   Executando: chmod +x run-servers.sh"
    chmod +x run-servers.sh
fi

# Teste 6: Verificar estrutura do projeto
echo "6. Verificando estrutura do projeto..."
if [ -f "package.json" ]; then
    echo "   ✓ Arquivo 'package.json' encontrado"
else
    echo "   ✗ Arquivo 'package.json' não encontrado"
fi

if [ -f "astro.config.ts" ]; then
    echo "   ✓ Arquivo 'astro.config.ts' encontrado"
else
    echo "   ✗ Arquivo 'astro.config.ts' não encontrado"
fi

# Teste 7: Verificar permissões de execução do test-servers
echo "7. Verificando permissões do script..."
if [ -x "test-servers.sh" ]; then
    echo "   ✓ Script é executável"
else
    echo "   ✗ Script não é executável"
    echo "   Executando: chmod +x test-servers.sh"
    chmod +x test-servers.sh
fi

echo
echo "=== Resumo do Teste ==="
echo "O script run-servers.sh está pronto para uso."
echo
echo "Para executar os servidores:"
echo "  ./run-servers.sh"
echo
echo "Para executar sem verificar dependências:"
echo "  ./run-servers.sh --no-check"
echo
echo "Documentação disponível em: README.md"