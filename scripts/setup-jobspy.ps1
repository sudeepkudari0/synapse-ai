$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$jobspyDir = Join-Path $projectRoot "native\jobspy"

Write-Host "Setting up JobSpy Python environment..."
Set-Location $jobspyDir

Write-Host "Creating virtual environment using uv..."
uv venv --python 3.11 venv
if ($LASTEXITCODE -ne 0) { throw "uv venv failed" }

$env:Path = "$jobspyDir\venv\Scripts;" + $env:Path

Write-Host "Installing requirements with uv..."
uv pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "uv pip install requirements failed" }

Write-Host "Done! The jobspy environment is ready."
