$ErrorActionPreference = "Stop"

$mavVersion = "3.9.6"
$mavenUrl = "https://archive.apache.org/dist/maven/maven-3/$mavVersion/binaries/apache-maven-$mavVersion-bin.zip"
$toolsDir = Join-Path $PSScriptRoot "tools"
$mavenDir = Join-Path $toolsDir "maven"
$zipPath = Join-Path $toolsDir "maven.zip"

# Create tools directory
if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir | Out-Null
    Write-Host "Created tools directory."
}

# Download Maven if not present
if (-not (Test-Path $mavenDir)) {
    Write-Host "Downloading Portable Maven $mavVersion..."
    Invoke-WebRequest -Uri $mavenUrl -OutFile $zipPath
    
    Write-Host "Extracting Maven..."
    Expand-Archive -Path $zipPath -DestinationPath $toolsDir
    
    # Rename extracted folder to 'maven'
    $extractedFolder = Join-Path $toolsDir "apache-maven-$mavVersion"
    Rename-Item -Path $extractedFolder -NewName "maven"
    
    # Cleanup zip
    Remove-Item $zipPath
    Write-Host "Maven installed to $mavenDir"
}
else {
    Write-Host "Maven already exists in tools/maven"
}

Write-Host "Setup Complete."
