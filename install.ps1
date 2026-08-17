# ATHELGARD CLI INSTALLER for PowerShell
# Run: iwr -useb https://raw.githubusercontent.com/NyxSpecter4/athelgard-cli/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/NyxSpecter4/athelgard-cli.git"
$InstallDir = "$env:USERPROFILE\.athelgard-cli"
$BinDir = "$env:USERPROFILE\.local\bin"

Write-Host "🐉 Installing Athelgard CLI..." -ForegroundColor Cyan

# Create bin dir if needed
if (!(Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

# Clone or update repo
if (Test-Path $InstallDir) {
    Write-Host "   Updating existing install..." -ForegroundColor Gray
    Set-Location $InstallDir
    git pull origin master
} else {
    Write-Host "   Cloning from GitHub..." -ForegroundColor Gray
    git clone $RepoUrl $InstallDir
    Set-Location $InstallDir
}

# Create cmd wrapper
$WrapperPath = "$BinDir\athelgard.cmd"
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (!$NodePath) {
    Write-Host "❌ Node.js not found. Please install Node.js first: https://nodejs.org" -ForegroundColor Red
    exit 1
}

@"
@echo off
"$NodePath" "$InstallDir\athelgard.js" %*
"@ | Set-Content -Path $WrapperPath -Encoding ASCII

Write-Host "   Created wrapper: $WrapperPath" -ForegroundColor Gray

# Add to PATH if needed
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$BinDir*") {
    Write-Host "   Adding $BinDir to PATH..." -ForegroundColor Gray
    [Environment]::SetEnvironmentVariable("PATH", "$UserPath;$BinDir", "User")
    Write-Host "   ✅ Added to PATH — restart your terminal or run: `$env:PATH += `";$BinDir`"" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ ATHELGARD INSTALLED!" -ForegroundColor Green
Write-Host ""
Write-Host "Run: athelgard status" -ForegroundColor Cyan
Write-Host "Run: athelgard ask `"How do I write a React hook?`"" -ForegroundColor Cyan
Write-Host "Run: athelgard help" -ForegroundColor Cyan
Write-Host ""
