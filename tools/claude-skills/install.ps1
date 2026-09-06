#!/usr/bin/env pwsh
# Install the skills in this directory into %USERPROFILE%\.claude\skills (user-global scope).
#
# Windows-native counterpart to install.sh - use this one on Windows. Running
# install.sh under WSL bash would resolve $HOME to the WSL filesystem, which is
# not where a Windows install of Claude Code reads its skills from.
#
#   .\tools\claude-skills\install.ps1
#
# Override the destination with $env:CLAUDE_SKILLS_DIR if your config lives
# somewhere else.

$ErrorActionPreference = 'Stop'

$src = $PSScriptRoot
$dest = if ($env:CLAUDE_SKILLS_DIR) { $env:CLAUDE_SKILLS_DIR } else { Join-Path $HOME '.claude\skills' }

New-Item -ItemType Directory -Force -Path $dest | Out-Null

Get-ChildItem -Path $src -Directory | ForEach-Object {
    $target = Join-Path $dest $_.Name
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    Copy-Item -Recurse -Path $_.FullName -Destination $target
    Write-Host "installed: $target"
}

Write-Host ""
Write-Host "Restart Claude Code (or start a new session) to pick them up."
