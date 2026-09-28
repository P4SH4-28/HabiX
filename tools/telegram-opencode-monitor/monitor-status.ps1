[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$launcher = Get-PythonLauncher
if (-not $launcher) {
    Write-Host "FAIL: Python bulunamadi (python veya py PATH'te olmali)"
    exit 1
}
$monitor = Join-Path $PSScriptRoot "monitor.py"
& $launcher.Path @($launcher.Arguments) $monitor --status
exit $LASTEXITCODE
