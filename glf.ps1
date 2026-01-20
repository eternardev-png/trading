$scriptPath = $PSScriptRoot
$pythonPath = Join-Path $scriptPath ".venv\Scripts\python.exe"
$scriptFile = Join-Path $scriptPath "glf.py"

& $pythonPath $scriptFile $args
