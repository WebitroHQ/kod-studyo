# Kod Studyo installer for Windows.
# Downloads the latest release, installs it for the current user (no admin rights needed)
# and, if the Claude Code CLI is present, registers the MCP server so AI agents can use it.
#
#   irm https://raw.githubusercontent.com/WebitroHQ/kod-studyo/main/scripts/install.ps1 | iex
#
# Options (when run as a file): -NoMcp  skip MCP registration;  -Version v0.2.0  install a specific release.
param([switch]$NoMcp, [string]$Version = 'latest')

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = 'WebitroHQ/kod-studyo'

Write-Host "Kod Studyo: downloading the Windows installer ($Version)..."
$tmp = Join-Path $env:TEMP ('kod-studyo-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tmp | Out-Null
$gh = Get-Command gh -ErrorAction SilentlyContinue
$viaGh = $false
if ($gh) {
  # GitHub CLI (signed in) also works while the repository is private
  $ErrorActionPreference = 'Continue'
  $tagArg = if ($Version -eq 'latest') { @() } else { @($Version) }
  & gh release download @tagArg --repo $repo --pattern '*Setup*.exe' --dir $tmp 2>&1 | Out-Null
  $ErrorActionPreference = 'Stop'
  $viaGh = [bool](Get-ChildItem $tmp -Filter '*Setup*.exe')
}
if (-not $viaGh) {
  $api = if ($Version -eq 'latest') { "https://api.github.com/repos/$repo/releases/latest" } else { "https://api.github.com/repos/$repo/releases/tags/$Version" }
  $release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'kod-studyo-installer' }
  $asset = $release.assets | Where-Object { $_.name -like '*Setup*.exe' } | Select-Object -First 1
  if (-not $asset) { throw "No Windows installer found in release $($release.tag_name)." }
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile (Join-Path $tmp $asset.name) -UseBasicParsing
}
$setup = (Get-ChildItem $tmp -Filter '*Setup*.exe' | Select-Object -First 1).FullName
Write-Host "Downloaded $(Split-Path $setup -Leaf)"

Write-Host 'Installing (per user)...'
Start-Process -FilePath $setup -ArgumentList '/S' -Wait
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

$dir = Join-Path $env:LOCALAPPDATA 'Programs\kod-studyo'
$exe = Join-Path $dir 'kod-studyo.exe'
$script = Join-Path $dir 'resources\app\bin\kod-studyo.mjs'
if (-not (Test-Path $exe)) { throw "Installation finished but $exe was not found." }
Write-Host "Installed: $exe"

$mcpArgs = @('mcp', 'add', 'kod-studyo', '-s', 'user', '-e', 'ELECTRON_RUN_AS_NODE=1', '--', $exe, $script, 'mcp')
if (-not $NoMcp -and (Get-Command claude -ErrorAction SilentlyContinue)) {
  $ErrorActionPreference = 'Continue'
  try { & claude mcp remove kod-studyo -s user 2>&1 | Out-Null } catch { }
  & claude @mcpArgs
  Write-Host 'Registered the "kod-studyo" MCP server with Claude Code.'
} else {
  Write-Host ''
  Write-Host 'To connect an AI agent (MCP), use:'
  Write-Host "  command: $exe"
  Write-Host "  args:    $script mcp"
  Write-Host '  env:     ELECTRON_RUN_AS_NODE=1'
}
Write-Host ''
Write-Host 'Done. Start "Kod Studyo" from the Start menu or the desktop shortcut.'
