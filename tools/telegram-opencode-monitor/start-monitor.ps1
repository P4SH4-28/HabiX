[CmdletBinding()]
param(
    [int]$Interval = 10,
    [switch]$Force
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$stateDir = Join-Path $PSScriptRoot "state"
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir | Out-Null }
$pidFile = Join-Path $stateDir "monitor.pid"

$runningPid = Get-MonitorPid
if ($runningPid) {
    if ($Force) {
        Write-Host "Mevcut monitor durduruluyor (pid $runningPid)..."
        Stop-Process -Id $runningPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 700
    } else {
        Write-Host "Monitor zaten calisiyor (pid $runningPid). Durdurmak icin: .\stop-monitor.ps1"
        exit 0
    }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

$launcher = Get-PythonLauncher
if (-not $launcher) {
    Write-Host "FAIL: Python bulunamadi (python veya py PATH'te olmali)"
    exit 1
}

$outLog = Join-Path $stateDir "monitor.out"
$errLog = Join-Path $stateDir "monitor.err"
Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

$script = Join-Path $PSScriptRoot "monitor.py"
$argList = @($launcher.Arguments) + @($script, "--interval", "$Interval")
Start-Process -FilePath $launcher.Path `
    -ArgumentList $argList `
    -WorkingDirectory $PSScriptRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog | Out-Null

Start-Sleep -Seconds 2
$newPid = Get-MonitorPid
if ($newPid) {
    Write-Host "Monitor baslatildi (pid $newPid, interval $Interval sn)"
    Write-Host "Loglar : state\monitor.log | state\monitor.out"
    Write-Host "Durdur : .\stop-monitor.ps1"
    exit 0
}
Write-Host "Monitor baslatilamadi. Hata ciktisi:"
if (Test-Path $errLog) { Get-Content $errLog -Tail 20 }
exit 1
