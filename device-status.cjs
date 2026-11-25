const { execFile } = require('node:child_process');
const path = require('node:path');

const windowsStatus = String.raw`
$ErrorActionPreference = 'Stop'
$apps = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -ExpandProperty ProcessName | Sort-Object -Unique | Select-Object -First 30)
if ($args[0] -eq 'apps') {
  @{ apps = $apps } | ConvertTo-Json -Compress
  exit
}
function Snapshot {
  @(Get-Process | Where-Object { $_.Id -ne 0 } | Select-Object Id, ProcessName, CPU, WorkingSet64)
}
$before = @{}
$watch = [Diagnostics.Stopwatch]::StartNew()
Snapshot | ForEach-Object { $before[$_.Id] = $_ }
Start-Sleep -Milliseconds 400
$after = Snapshot
$elapsed = $watch.Elapsed.TotalSeconds
$cores = [Environment]::ProcessorCount
$usage = @($after | ForEach-Object {
  $last = $before[$_.Id]
  $cpu = $null
  if ($last -and $last.ProcessName -eq $_.ProcessName -and $null -ne $_.CPU -and $null -ne $last.CPU -and $_.CPU -ge $last.CPU) {
    $cpu = [Math]::Round(100 * ($_.CPU - $last.CPU) / ($elapsed * $cores), 1)
  }
  @{ name = $_.ProcessName; cpuPercent = $cpu; ramMiB = [Math]::Round($_.WorkingSet64 / 1MB) }
})
@{
  apps = $apps
  sampleSeconds = [Math]::Round($elapsed, 2)
  topCpu = @($usage | Where-Object { $null -ne $_.cpuPercent } | Sort-Object { $_.cpuPercent } -Descending | Select-Object -First 6)
  topRam = @($usage | Sort-Object { $_.ramMiB } -Descending | Select-Object -First 6)
} | ConvertTo-Json -Compress -Depth 4
`;

function deviceStatus(view, signal, { platform = process.platform, execute = execFile } = {}) {
  if (platform !== 'win32') return Promise.resolve({ error: 'This device check is available on Windows.' });
  if (!['apps', 'usage'].includes(view)) return Promise.resolve({ error: 'Choose apps or usage.' });
  const root = process.env.SystemRoot || 'C:\\Windows';
  const exe = path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = "& { " + windowsStatus + " } '" + view + "'";
  return new Promise(resolve => {
    execute(exe, ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, shell: false, timeout: 5000, maxBuffer: 32768, signal,
    }, (error, stdout) => {
      if (error) return resolve({ error: signal?.aborted ? 'Device check cancelled.' : 'Windows process information could not be read.' });
      try { resolve(JSON.parse(stdout)); }
      catch { resolve({ error: 'Windows returned an invalid process snapshot.' }); }
    });
  });
}

module.exports = { deviceStatus };
