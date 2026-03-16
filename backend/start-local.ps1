param(
    [string]$EnvFile = ".env.local",
    [string]$Profile = "local"
)

$ErrorActionPreference = "Stop"

function Set-EnvFromFile {
    param([string]$Path)

    foreach ($rawLine in Get-Content $Path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            continue
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        Set-Item -Path "Env:$name" -Value $value
    }
}

function Get-MissingEnvVars {
    param([string[]]$Names)

    return $Names | Where-Object {
        $current = Get-Item -Path "Env:$_" -ErrorAction SilentlyContinue
        -not $current -or [string]::IsNullOrWhiteSpace($current.Value)
    }
}

$envPath = Join-Path $PSScriptRoot $EnvFile
if (-not (Test-Path $envPath)) {
    Write-Error "No se encontro $EnvFile en $PSScriptRoot."
}

Set-EnvFromFile -Path $envPath

$mailToggle = if ($null -ne $env:APP_MAIL_ENABLED) { $env:APP_MAIL_ENABLED } else { "" }
$mailEnabled = $mailToggle.ToLowerInvariant() -eq "true"
$requiredMailVars = @("MAIL_HOST", "MAIL_USERNAME", "MAIL_PASSWORD", "APP_MAIL_FROM")
$missingMailVars = @(Get-MissingEnvVars -Names $requiredMailVars)
$serverPort = if ($null -ne $env:SERVER_PORT -and -not [string]::IsNullOrWhiteSpace($env:SERVER_PORT)) {
    $env:SERVER_PORT
} else {
    "8080"
}

Write-Host "Configuracion local cargada desde $EnvFile" -ForegroundColor Cyan
Write-Host "Backend en puerto $serverPort" -ForegroundColor Cyan

if ($mailEnabled -and $missingMailVars.Count -eq 0) {
    Write-Host "SMTP listo para Gmail real." -ForegroundColor Green
} elseif ($mailEnabled) {
    Write-Warning "APP_MAIL_ENABLED=true pero faltan variables: $($missingMailVars -join ', ')"
} else {
    Write-Host "SMTP deshabilitado. Cambia APP_MAIL_ENABLED=true cuando completes tus datos de Gmail." -ForegroundColor Yellow
}

Write-Host "Levantando Spring Boot con perfil $Profile..." -ForegroundColor Cyan
& "$PSScriptRoot\mvnw.cmd" spring-boot:run "-Dspring-boot.run.profiles=$Profile"
