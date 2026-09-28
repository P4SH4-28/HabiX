function Get-PythonLauncher {
    foreach ($name in @("python", "py")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source) {
            if ($name -eq "py") {
                return [pscustomobject]@{ Path = $cmd.Source; Arguments = @("-3") }
            }
            return [pscustomobject]@{ Path = $cmd.Source; Arguments = @() }
        }
    }
    return $null
}

function Get-MonitorPid {
    $pidFile = Join-Path $PSScriptRoot "state\monitor.pid"
    if (-not (Test-Path $pidFile)) { return $null }
    $candidate = 0
    try { $candidate = [int](Get-Content $pidFile -Raw).Trim() } catch { $candidate = 0 }
    if ($candidate -le 0) { return $null }
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$candidate" -ErrorAction SilentlyContinue
    if ($proc -and $proc.CommandLine -match 'monitor\.py') { return $candidate }
    return $null
}
