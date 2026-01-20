$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$mvnBin = Join-Path $scriptDir "tools\maven\bin\mvn.cmd"
$javaUiDir = Join-Path $scriptDir "java_ui"

if (-not (Test-Path $mvnBin)) {
    Write-Error "Maven not found! Please run setup_env.ps1 first."
}

Write-Host "Starting Java UI..."
Set-Location $javaUiDir
& $mvnBin javafx:run
