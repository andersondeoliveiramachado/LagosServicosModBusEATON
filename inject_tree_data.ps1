$jsonPath = Join-Path $PSScriptRoot "mapa_registradores_eoton.json"
$htmlPath = Join-Path $PSScriptRoot "public\tree_viewer.html"

$jsonContent = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$htmlContent = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

$htmlContent = $htmlContent.Replace('EATON_MAP_PLACEHOLDER', $jsonContent)

[System.IO.File]::WriteAllText($htmlPath, $htmlContent, [System.Text.Encoding]::UTF8)
Write-Host "OK - tree_viewer.html atualizado com os dados do mapa."
