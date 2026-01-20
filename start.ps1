# --- CONFIGURATION ---
$VENV_PATH = ".\.venv"
$PYTHON_EXEC = "$VENV_PATH\Scripts\python.exe"
$BACKEND_DIR = ".\backend"
$BACKEND_SCRIPT = "server.py"
$FRONTEND_DIR = ".\frontend"
$FRONTEND_PORT = 5173

# --- CHECK VENV ---
if (-not (Test-Path $PYTHON_EXEC)) {
    Write-Host "VirtualEnv not found at $VENV_PATH" -ForegroundColor Red
    Write-Host "Please run setup_env.ps1 first."
    exit 1
}

Write-Host "Using VirtualEnv Python: $PYTHON_EXEC" -ForegroundColor Cyan

# --- START BACKEND ---
Write-Host "Starting AlgoResearch Backend..." -ForegroundColor Green
# Backend logic: cd into folder then run
$backendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd backend; & '../$PYTHON_EXEC' server.py" -PassThru -WindowStyle Minimized

if ($backendProcess) {
    Write-Host "   Backend started (PID: $($backendProcess.Id)). Logs: backend\server.log"
} else {
    Write-Host "   Failed to start Backend." -ForegroundColor Red
    exit 1
}

# --- START FRONTEND ---
Write-Host "Starting Web Frontend..." -ForegroundColor Green
$npmCmd = "npm.cmd" 
$frontendProcess = Start-Process -FilePath $npmCmd -ArgumentList "run", "dev" -WorkingDirectory $FRONTEND_DIR -PassThru

# --- WAIT & OPEN BROWSER ---
$startupWait = 7
Write-Host "Waiting $startupWait seconds for services to spin up..." -ForegroundColor Yellow
Start-Sleep -Seconds $startupWait

$url = "http://localhost:$FRONTEND_PORT"
Write-Host "Opening Browser... $url" -ForegroundColor Cyan
Start-Process $url

# --- READY ---
Write-Host "--- AlgoResearch Lab Running ---" -ForegroundColor White
Write-Host "Backend running in background/minimized."
Write-Host "Frontend running in separate window."
Write-Host "Press Enter to stop Backend..."
Read-Host

# --- CLEANUP ---
Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue 
Write-Host "Stopped."
