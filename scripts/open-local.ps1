$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:5173/'

function Test-Site {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -like '*Eason Chan Music Cup*'
  } catch {
    return $false
  }
}

if (-not (Test-Site)) {
  if (-not (Test-Path -LiteralPath (Join-Path $project 'node_modules\vite\bin\vite.js'))) {
    Push-Location $project
    try { npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } }
    finally { Pop-Location }
  }

  $node = (Get-Command node -ErrorAction Stop).Source
  $vite = Join-Path $project 'node_modules\vite\bin\vite.js'
  Start-Process -FilePath $node -ArgumentList @($vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $project -WindowStyle Hidden
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    if (Test-Site) { $ready = $true; break }
  }
  if (-not $ready) { throw 'Website did not start on 127.0.0.1:5173. Check whether port 5173 is in use.' }
}

Start-Process $url
