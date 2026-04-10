# setup-whisper.ps1
# Downloads whisper.cpp binary and model for Electro-HID
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-whisper.ps1

param(
    [string]$Model = "base.en",
    [string]$WhisperVersion = "v1.8.4"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProjectRoot) {
    $ProjectRoot = (Get-Location).Path
}
# If run from project root via npm script, use current directory
if (Test-Path (Join-Path (Get-Location).Path "native")) {
    $ProjectRoot = (Get-Location).Path
}

$WhisperDir = Join-Path $ProjectRoot "native\whisper"
$ModelsDir = Join-Path $WhisperDir "models"
$TempDir = Join-Path $ProjectRoot "native\whisper\.tmp"

# Colors for output
function Write-Step($msg) { Write-Host "`n=> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "   [SKIP] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }

# ─── Ensure directories ───
Write-Step "Setting up directories"
New-Item -ItemType Directory -Force -Path $WhisperDir | Out-Null
New-Item -ItemType Directory -Force -Path $ModelsDir  | Out-Null
New-Item -ItemType Directory -Force -Path $TempDir    | Out-Null
Write-OK "Directories ready"

# ─── Download whisper.exe ───
$WhisperExe = Join-Path $WhisperDir "whisper-cli.exe"
$WhisperExeAlt = Join-Path $WhisperDir "whisper.exe"

if ((Test-Path $WhisperExe) -or (Test-Path $WhisperExeAlt)) {
    Write-Step "Checking whisper binary"
    Write-Skip "whisper binary already exists, skipping download"
} else {
    Write-Step "Downloading whisper.cpp $WhisperVersion (Windows x64)"
    
    $ZipName = "whisper-bin-x64.zip"
    $DownloadUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/$WhisperVersion/$ZipName"
    $ZipPath = Join-Path $TempDir $ZipName
    $ExtractDir = Join-Path $TempDir "extracted"

    try {
        Write-Host "   Downloading from: $DownloadUrl"
        # Use TLS 1.2
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing
        $ProgressPreference = 'Continue'
        
        Write-OK "Downloaded $ZipName"
    } catch {
        Write-Fail "Failed to download from: $DownloadUrl"
        Write-Host "   Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "   You may need to download manually:" -ForegroundColor Yellow
        Write-Host "   1. Go to https://github.com/ggml-org/whisper.cpp/releases/tag/$WhisperVersion"
        Write-Host "   2. Download the Windows x64 binary zip"
        Write-Host "   3. Extract whisper-cli.exe (or whisper.exe) into native/whisper/"
        Write-Host ""
        # Clean up temp
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
        exit 1
    }

    # Extract
    Write-Step "Extracting binary"
    if (Test-Path $ExtractDir) { Remove-Item -Recurse -Force $ExtractDir }
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

    # Find the exe - it could be whisper-cli.exe or whisper.exe depending on version
    $ExeFile = Get-ChildItem -Path $ExtractDir -Recurse -Filter "whisper-cli.exe" | Select-Object -First 1
    if (-not $ExeFile) {
        $ExeFile = Get-ChildItem -Path $ExtractDir -Recurse -Filter "whisper.exe" | Select-Object -First 1
    }
    if (-not $ExeFile) {
        $ExeFile = Get-ChildItem -Path $ExtractDir -Recurse -Filter "main.exe" | Select-Object -First 1
    }

    if ($ExeFile) {
        # Copy the exe, renaming to whisper.exe for compatibility
        Copy-Item $ExeFile.FullName -Destination $WhisperExeAlt -Force
        Write-OK "Copied $($ExeFile.Name) -> whisper.exe"
        
        # Also find and copy whisper-server.exe if present
        $ServerExe = Get-ChildItem -Path $ExtractDir -Recurse -Filter "whisper-server.exe" | Select-Object -First 1
        if ($ServerExe) {
            Copy-Item $ServerExe.FullName -Destination (Join-Path $WhisperDir "whisper-server.exe") -Force
            Write-OK "Copied $($ServerExe.Name) -> whisper-server.exe"
        }

        # Also copy any DLLs that came with it (ggml.dll, whisper.dll, etc.)
        $DllFiles = Get-ChildItem -Path $ExeFile.DirectoryName -Filter "*.dll" -ErrorAction SilentlyContinue
        foreach ($dll in $DllFiles) {
            Copy-Item $dll.FullName -Destination $WhisperDir -Force
            Write-OK "Copied $($dll.Name)"
        }
    } else {
        Write-Fail "Could not find whisper executable in the extracted archive"
        Write-Host "   Contents of archive:" -ForegroundColor Yellow
        Get-ChildItem -Path $ExtractDir -Recurse | ForEach-Object { Write-Host "     $($_.FullName)" }
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
        exit 1
    }
}

# ─── Download model ───
$ModelFile = "ggml-$Model.bin"
$ModelPath = Join-Path $ModelsDir $ModelFile

if (Test-Path $ModelPath) {
    Write-Step "Checking model"
    Write-Skip "$ModelFile already exists, skipping download"
} else {
    Write-Step "Downloading model: $ModelFile"
    
    $ModelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$ModelFile"
    
    try {
        Write-Host "   Downloading from: $ModelUrl"
        Write-Host "   This may take a few minutes depending on your connection..."
        
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelPath -UseBasicParsing
        $ProgressPreference = 'Continue'
        
        $Size = [math]::Round((Get-Item $ModelPath).Length / 1MB, 1)
        Write-OK "Downloaded $ModelFile ($Size MB)"
    } catch {
        Write-Fail "Failed to download model from: $ModelUrl"
        Write-Host "   Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Download manually from:" -ForegroundColor Yellow
        Write-Host "   $ModelUrl"
        Write-Host "   Place the file at: $ModelPath"
        exit 1
    }
}

# ─── Cleanup temp ───
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}

# ─── Verify ───
Write-Step "Verification"
$exeExists = (Test-Path $WhisperExeAlt) -or (Test-Path $WhisperExe)
$modelExists = Test-Path $ModelPath

if ($exeExists) {
    Write-OK "whisper.exe found"
} else {
    Write-Fail "whisper.exe NOT found"
}

if ($modelExists) {
    Write-OK "$ModelFile found"
} else {
    Write-Fail "$ModelFile NOT found"
}

# List all files in whisper dir
Write-Host "`n   Files in native/whisper/:" -ForegroundColor Gray
Get-ChildItem -Path $WhisperDir -File | ForEach-Object {
    $size = if ($_.Length -gt 1MB) { "$([math]::Round($_.Length / 1MB, 1)) MB" } else { "$([math]::Round($_.Length / 1KB, 1)) KB" }
    Write-Host "     $($_.Name) ($size)" -ForegroundColor Gray
}
Get-ChildItem -Path $ModelsDir -File | ForEach-Object {
    $size = if ($_.Length -gt 1MB) { "$([math]::Round($_.Length / 1MB, 1)) MB" } else { "$([math]::Round($_.Length / 1KB, 1)) KB" }
    Write-Host "     models/$($_.Name) ($size)" -ForegroundColor Gray
}

if ($exeExists -and $modelExists) {
    Write-Host "`n✅ Whisper setup complete! You can now run 'bun dev'" -ForegroundColor Green
} else {
    Write-Host "`n❌ Setup incomplete. Please resolve the issues above." -ForegroundColor Red
    exit 1
}
