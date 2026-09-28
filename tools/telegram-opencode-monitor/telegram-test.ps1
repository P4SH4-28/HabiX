[CmdletBinding()]
param(
    [string]$Message = "🟢 HabitTracker Telegram bağlantısı başarılı."
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$launcher = Get-PythonLauncher
if (-not $launcher) {
    Write-Host "FAIL: Python bulunamadi (python veya py PATH'te olmali)"
    exit 1
}
$notify = Join-Path $PSScriptRoot "notify.py"
& $launcher.Path @($launcher.Arguments) $notify --text $Message
exit $LASTEXITCODE
