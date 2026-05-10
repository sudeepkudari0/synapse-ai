# Quick setup script for downloading Whisper model

Write-Host "[Whisper] Whisper.cpp Model Downloader" -ForegroundColor Cyan
Write-Host ""

$modelsDir = "native\whisper\models"

# Create directory if it doesn't exist
if (!(Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

# Model options
Write-Host "Available models and 4GB GPU Suitability:" -ForegroundColor Yellow
Write-Host "1. tiny.en   (75 MB)   | ~400MB VRAM | Effortless - Extremely fast, basic accuracy"
Write-Host "2. base.en   (142 MB)  | ~600MB VRAM | Recommended - Best balance of speed & low VRAM impact"
Write-Host "3. small.en  (466 MB)  | ~1.5GB VRAM | Recommended - High accuracy, but uses more VRAM"
Write-Host "4. medium.en (1.5 GB)  | ~3.0GB VRAM | Warning - Usable, but leaves little VRAM for games/apps"
Write-Host "5. large-v3  (2.9 GB)  | ~4.5GB+VRAM | Not Recommended - Will likely OOM on 4GB GPU"
Write-Host ""

$choice = Read-Host "Select model (1-5)"

$modelName = switch ($choice) {
    "1" { "tiny.en" }
    "2" { "base.en" }
    "3" { "small.en" }
    "4" { "medium.en" }
    "5" { "large-v3" }
    default { "base.en" }
}

$fileName = "ggml-$modelName.bin"
$filePath = Join-Path $modelsDir $fileName
$url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$fileName"

Write-Host ""
Write-Host "Downloading $fileName..." -ForegroundColor Green
Write-Host "URL: $url"
Write-Host ""

try {
    Invoke-WebRequest -Uri $url -OutFile $filePath -UseBasicParsing
    Write-Host "[OK] Downloaded successfully!" -ForegroundColor Green
    Write-Host "Location: $filePath"
    Write-Host ""
    Write-Host "File size: $((Get-Item $filePath).Length / 1MB) MB"
} catch {
    Write-Host "[Error] Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[Done] Model ready! Now you need whisper.exe (see docs/WHISPER_NATIVE_SETUP.md)" -ForegroundColor Cyan
