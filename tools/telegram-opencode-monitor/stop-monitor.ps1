[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$pidFile = Join-Path $PSScriptRoot "state\monitor.pid"
if (-not (Test-Path $pidFile)) {
    Write-Host "Monitor calismiyor (pid dosyasi yok)."
    exit 0
}
$mid = 0
try { $mid = [int](Get-Content $pidFile -Raw).Trim() } catch { $mid = 0 }
if ($mid -le 0) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Monitor calismiyor (gecersiz pid dosyasi temizlendi)."
    exit 0
}
$proc = Get-CimInstance Win32_Process -Filter "ProcessId=$mid" -ErrorAction SilentlyContinue
if (-not $proc) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Monitor calismiyor (stale pid temizlendi)."
    exit 0
}
if ($proc.CommandLine -notmatch 'monitor\.py') {
    Write-Host "UYARI: pid $mid bir monitor degil ($($proc.Name)). Islem dokunulmadi."
    exit 1
}
Stop-Process -Id $mid -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 700
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Monitor durduruldu (pid $mid)."
exit 0
