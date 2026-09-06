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

$script:failed = $false

Get-ChildItem -Path $src -Directory | ForEach-Object {
    $target = Join-Path $dest $_.Name
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    Copy-Item -Recurse -Path $_.FullName -Destination $target

    # A Windows clone with core.autocrlf=true rewrites LF to CRLF on checkout.
    # Claude Code matches the frontmatter block on \n and bash chokes on \r, so
    # normalise every text file back to LF, no BOM. .gitattributes covers fresh
    # clones; this covers the one already on disk.
    Get-ChildItem -Path $target -Recurse -File |
        Where-Object { $_.Extension -in '.md', '.sh' } |
        ForEach-Object {
            $text = [System.IO.File]::ReadAllText($_.FullName)
            $text = $text -replace "`r`n", "`n"
            [System.IO.File]::WriteAllText($_.FullName, $text)   # UTF8, no BOM
        }

    # Verify, rather than printing "installed" and hoping. A BOM, a CR, or a
    # frontmatter block that does not open on line 1 all make Claude Code skip
    # the skill silently, which is exactly the failure this is here to catch.
    $skillMd = Join-Path $target 'SKILL.md'
    $ok = $false
    $why = 'no SKILL.md'
    if (Test-Path $skillMd) {
        $bytes = [System.IO.File]::ReadAllBytes($skillMd)
        $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
        $text = [System.IO.File]::ReadAllText($skillMd)
        $lines = $text -split "`n"
        if ($hasBom)                          { $why = 'file starts with a UTF-8 BOM' }
        elseif ($text.Contains("`r"))         { $why = 'file still contains CR' }
        elseif ($lines[0].Trim() -ne '---')   { $why = "line 1 is not '---'" }
        elseif (-not ($text -match '(?m)^name: \S')) { $why = 'no single-line name: field' }
        elseif (-not ($text -match '(?m)^description: \S')) { $why = 'no single-line description: field' }
        elseif ($text -match '(?m)^(description|name): *[>|]') { $why = 'frontmatter uses a YAML block scalar (>- or |); it must be on one line' }
        else                                  { $ok = $true }
    }

    if ($ok) {
        Write-Host "installed + verified: $target"
    } else {
        Write-Host "installed BUT UNUSABLE ($why): $target" -ForegroundColor Red
        $script:failed = $true
    }
}

Write-Host ""
if ($script:failed) {
    Write-Host "At least one skill will not load. See the reason above." -ForegroundColor Red
    exit 1
}
Write-Host "Restart Claude Code (or start a new session) to pick them up."
