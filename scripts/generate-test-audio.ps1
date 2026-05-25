<#
.SYNOPSIS
    Generates TTS audio test fixtures for E2E mock interview testing.
    Uses Windows SAPI (System.Speech.Synthesis) to create 16kHz mono WAV files.

.DESCRIPTION
    Creates WAV files for:
    - Interviewer questions (should trigger question detection)
    - User answers (should NOT trigger question detection)
    - Acknowledgments (should NOT trigger question detection)
    - Silence/noise (should be filtered by hallucination filter)

    Output: test-data/interview-audio/
    Format: 16kHz, 16-bit, Mono PCM WAV

.USAGE
    powershell -ExecutionPolicy Bypass -File scripts/generate-test-audio.ps1
#>

Add-Type -AssemblyName System.Speech

$ErrorActionPreference = "Stop"

# ─── Configuration ───────────────────────────────────────────────────
$OutputDir = Join-Path $PSScriptRoot "..\test-data\interview-audio"
$SampleRate = 16000
$BitsPerSample = [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen
$Channels = [System.Speech.AudioFormat.AudioChannel]::Mono

# ─── Interview Questions (Interviewer Voice) ─────────────────────────
$InterviewerQuestions = @(
    @{ Id = "behavioral-01"; Text = "Tell me about a time when you had to handle a challenging project deadline. How did you manage it?" },
    @{ Id = "behavioral-02"; Text = "Can you describe a situation where you had to work with a difficult team member?" },
    @{ Id = "technical-01"; Text = "What is the difference between a hash map and a binary search tree in terms of time complexity?" },
    @{ Id = "technical-02"; Text = "How would you explain the concept of closures in JavaScript?" },
    @{ Id = "technical-03"; Text = "What are the main differences between REST and GraphQL APIs?" },
    @{ Id = "system-design-01"; Text = "How would you design a URL shortening service like bit.ly?" },
    @{ Id = "system-design-02"; Text = "Walk me through how you would design a real-time chat application at scale." },
    @{ Id = "general-01"; Text = "Why are you interested in this position and what draws you to our company?" },
    @{ Id = "general-02"; Text = "Where do you see yourself in five years?" },
    @{ Id = "coding-01"; Text = "Given an array of integers, how would you find two numbers that add up to a target sum?" }
)

# ─── User Answers ────────────────────────────────────────────────────
$UserAnswers = @(
    @{ Id = "answer-01"; Text = "In my previous role at the startup, we had a critical product launch with a two week deadline. I broke the project into smaller milestones and coordinated daily standups with the team." },
    @{ Id = "answer-02"; Text = "I would use a hash map approach. First, I iterate through the array and for each element, I check if the complement exists in the map. This gives us O of n time complexity." },
    @{ Id = "answer-03"; Text = "I'm really excited about this role because it combines my passion for distributed systems with the opportunity to work on products that impact millions of users." },
    @{ Id = "answer-04"; Text = "For the URL shortener, I would start with a simple architecture. A web server that takes long URLs, generates a unique short code using base 62 encoding, stores the mapping in a database, and redirects when accessed." }
)

# ─── Acknowledgments (Should NOT trigger question detection) ─────────
$Acknowledgments = @(
    @{ Id = "ack-01"; Text = "Okay, great. That sounds good." },
    @{ Id = "ack-02"; Text = "Right, I see. Interesting." },
    @{ Id = "ack-03"; Text = "Perfect, thank you for that explanation." },
    @{ Id = "ack-04"; Text = "Got it. Let's move on to the next topic." }
)

# ─── Generate Audio ──────────────────────────────────────────────────

function Generate-Audio {
    param(
        [string]$Id,
        [string]$Text,
        [string]$Category,
        [string]$VoiceGender = "Male"
    )

    $categoryDir = Join-Path $OutputDir $Category
    if (-not (Test-Path $categoryDir)) {
        New-Item -ItemType Directory -Path $categoryDir -Force | Out-Null
    }

    $filePath = Join-Path $categoryDir "$Id.wav"

    # Skip if file already exists
    if (Test-Path $filePath) {
        Write-Host "  [SKIP] $filePath (already exists)" -ForegroundColor DarkGray
        return
    }

    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        # Select voice by gender
        $voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled }
        $targetVoice = $voices | Where-Object {
            $_.VoiceInfo.Gender -eq $VoiceGender
        } | Select-Object -First 1

        if ($targetVoice) {
            $synth.SelectVoice($targetVoice.VoiceInfo.Name)
        }

        # Set output format: 16kHz, 16-bit, Mono
        $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
            $SampleRate, $BitsPerSample, $Channels
        )
        $synth.SetOutputToWaveFile($filePath, $format)

        # Adjust speech rate for natural conversation
        $synth.Rate = 0  # Normal speed (-10 to 10)

        # Speak the text
        $synth.Speak($Text)

        Write-Host "  [OK] $filePath" -ForegroundColor Green
    }
    catch {
        Write-Host "  [ERR] $filePath : $_" -ForegroundColor Red
    }
    finally {
        $synth.Dispose()
    }
}

function Generate-SilenceWav {
    param(
        [string]$FilePath,
        [int]$DurationMs = 3000
    )

    if (Test-Path $FilePath) {
        Write-Host "  [SKIP] $FilePath (already exists)" -ForegroundColor DarkGray
        return
    }

    $numSamples = [int]($SampleRate * $DurationMs / 1000)
    $bytesPerSample = 2
    $dataSize = $numSamples * $bytesPerSample
    $fileSize = 36 + $dataSize

    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)

    # RIFF header
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
    $bw.Write([int]$fileSize)
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))

    # fmt subchunk
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
    $bw.Write([int]16)        # subchunk size
    $bw.Write([int16]1)       # PCM format
    $bw.Write([int16]1)       # mono
    $bw.Write([int]$SampleRate)
    $bw.Write([int]($SampleRate * $bytesPerSample))
    $bw.Write([int16]$bytesPerSample)
    $bw.Write([int16]16)      # bits per sample

    # data subchunk
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
    $bw.Write([int]$dataSize)

    # Write silence (zeros)
    $zeros = New-Object byte[] $dataSize
    $bw.Write($zeros)

    $bw.Flush()
    [System.IO.File]::WriteAllBytes($FilePath, $ms.ToArray())
    $bw.Dispose()
    $ms.Dispose()

    Write-Host "  [OK] $FilePath (silence: ${DurationMs}ms)" -ForegroundColor Green
}

# ─── Main ────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== Generating E2E Test Audio Fixtures ===" -ForegroundColor Cyan
Write-Host "Output: $OutputDir"
Write-Host "Format: ${SampleRate}Hz, 16-bit, Mono PCM WAV"
Write-Host ""

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Generate interviewer questions (male voice for variety)
Write-Host "Generating Interviewer Questions..." -ForegroundColor Yellow
foreach ($q in $InterviewerQuestions) {
    Generate-Audio -Id $q.Id -Text $q.Text -Category "interviewer" -VoiceGender "Male"
}

# Generate user answers (female voice for contrast)
Write-Host ""
Write-Host "Generating User Answers..." -ForegroundColor Yellow
foreach ($a in $UserAnswers) {
    Generate-Audio -Id $a.Id -Text $a.Text -Category "user" -VoiceGender "Female"
}

# Generate acknowledgments (male voice = interviewer)
Write-Host ""
Write-Host "Generating Acknowledgments..." -ForegroundColor Yellow
foreach ($ack in $Acknowledgments) {
    Generate-Audio -Id $ack.Id -Text $ack.Text -Category "acknowledgments" -VoiceGender "Male"
}

# Generate silence/noise fixtures
Write-Host ""
Write-Host "Generating Silence Fixtures..." -ForegroundColor Yellow
$silenceDir = Join-Path $OutputDir "silence"
if (-not (Test-Path $silenceDir)) {
    New-Item -ItemType Directory -Path $silenceDir -Force | Out-Null
}
Generate-SilenceWav -FilePath (Join-Path $silenceDir "silence-1s.wav") -DurationMs 1000
Generate-SilenceWav -FilePath (Join-Path $silenceDir "silence-3s.wav") -DurationMs 3000
Generate-SilenceWav -FilePath (Join-Path $silenceDir "silence-5s.wav") -DurationMs 5000

# Generate manifest
Write-Host ""
Write-Host "Generating manifest.json..." -ForegroundColor Yellow
$manifest = @{
    generated = (Get-Date -Format "o")
    sampleRate = $SampleRate
    bitsPerSample = 16
    channels = 1
    interviewer = @($InterviewerQuestions | ForEach-Object {
        @{ id = $_.Id; text = $_.Text; file = "interviewer/$($_.Id).wav" }
    })
    user = @($UserAnswers | ForEach-Object {
        @{ id = $_.Id; text = $_.Text; file = "user/$($_.Id).wav" }
    })
    acknowledgments = @($Acknowledgments | ForEach-Object {
        @{ id = $_.Id; text = $_.Text; file = "acknowledgments/$($_.Id).wav" }
    })
    silence = @(
        @{ id = "silence-1s"; durationMs = 1000; file = "silence/silence-1s.wav" },
        @{ id = "silence-3s"; durationMs = 3000; file = "silence/silence-3s.wav" },
        @{ id = "silence-5s"; durationMs = 5000; file = "silence/silence-5s.wav" }
    )
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $OutputDir "manifest.json") -Encoding UTF8

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Generated $(($InterviewerQuestions.Count + $UserAnswers.Count + $Acknowledgments.Count + 3)) audio files."
Write-Host "Manifest: $(Join-Path $OutputDir 'manifest.json')"
Write-Host ""
