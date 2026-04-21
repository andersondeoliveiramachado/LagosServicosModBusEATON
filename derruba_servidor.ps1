Write-Host "Verificando porta 3000..." -ForegroundColor Cyan

$port = 3000
$tcpConnections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($tcpConnections) {
    foreach ($connection in $tcpConnections) {
        $pidToKill = $connection.OwningProcess
        if ($pidToKill -ne 0) {
            Write-Host "Encerrando processo com PID $pidToKill vinculado à porta $port..." -ForegroundColor Yellow
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "Porta $port liberada." -ForegroundColor Green
} else {
    Write-Host "Nenhum processo bloqueando a porta $port." -ForegroundColor Green
}

Write-Host "`nLimpando todos os processos 'node.exe' em segundo plano..." -ForegroundColor Cyan
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "Todos os processos do Node.js foram encerrados com sucesso." -ForegroundColor Green
} else {
    Write-Host "Nenhum processo do Node.js ativo encontrado." -ForegroundColor Green
}

Write-Host "`nO ambiente está limpo! Você pode iniciar o servidor agora." -ForegroundColor Cyan
