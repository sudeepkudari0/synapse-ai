# Build Moonshine Python Server
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$moonshineDir = Join-Path $projectRoot "native\moonshine"
$whisperDir = Join-Path $projectRoot "native\whisper"

Write-Host "Building Moonshine v2 Server..."

Set-Location $moonshineDir

Write-Host "Creating Python virtual environment using uv..."
# Use uv to explicitly request Python 3.11, downloading it if necessary
uv venv --python 3.11 venv
if ($LASTEXITCODE -ne 0) { throw "uv venv failed" }

$env:Path = "$moonshineDir\venv\Scripts;" + $env:Path

Write-Host "Installing requirements with uv..."
uv pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "uv pip install requirements failed" }

uv pip install pyinstaller
if ($LASTEXITCODE -ne 0) { throw "uv pip install pyinstaller failed" }

Write-Host "Compiling executable with PyInstaller..."
python -m PyInstaller --noconfirm --onedir --windowed --name "moonshine-server" `
    --collect-all moonshine_voice `
    --hidden-import=soundfile `
    --hidden-import=uvicorn.logging `
    --hidden-import=uvicorn.loops `
    --hidden-import=uvicorn.loops.auto `
    --hidden-import=uvicorn.protocols `
    --hidden-import=uvicorn.protocols.http `
    --hidden-import=uvicorn.protocols.http.auto `
    --hidden-import=uvicorn.protocols.websockets `
    --hidden-import=uvicorn.protocols.websockets.auto `
    --hidden-import=uvicorn.lifespan `
    --hidden-import=uvicorn.lifespan.on `
    --hidden-import=uvicorn.lifespan.off `
    server.py
Write-Host "Copying to native/whisper directory..."
if (-Not (Test-Path $whisperDir)) {
    New-Item -ItemType Directory -Path $whisperDir | Out-Null
}

Copy-Item -Path "dist\moonshine-server\*" -Destination $whisperDir -Recurse -Force

Write-Host "Done! The moonshine-server.exe has been compiled and copied to native/whisper/"
