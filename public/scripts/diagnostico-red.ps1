<#
.SYNOPSIS
    Diagnóstico básico de red para adjuntar a un ticket de soporte.

.DESCRIPTION
    Revisa adaptadores activos, configuración IP, puerta de enlace, DNS y salida a internet.
    Muestra un resumen en pantalla y guarda un informe de texto en el escritorio del usuario.
    No modifica ninguna configuración.

.PARAMETER Reparar
    Si se indica, además vacía la caché DNS y renueva la IP (requiere administrador).

.EXAMPLE
    .\diagnostico-red.ps1
    .\diagnostico-red.ps1 -Reparar

.NOTES
    Compatible con Windows 10 y 11, PowerShell 5.1 o superior.
#>
[CmdletBinding()]
param(
    [switch]$Reparar
)

$ErrorActionPreference = 'Continue'
$fecha   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$informe = Join-Path ([Environment]::GetFolderPath('Desktop')) "diagnostico-red_$env:COMPUTERNAME`_$fecha.txt"
$lineas  = [System.Collections.Generic.List[string]]::new()

function Escribir {
    param([string]$Texto, [ConsoleColor]$Color = 'Gray')
    Write-Host $Texto -ForegroundColor $Color
    $lineas.Add($Texto)
}

function Resultado {
    param([string]$Prueba, [bool]$Ok, [string]$Detalle = '')
    $estado = if ($Ok) { 'OK   ' } else { 'FALLA' }
    $color  = if ($Ok) { 'Green' } else { 'Red' }
    Escribir ("[{0}] {1} {2}" -f $estado, $Prueba.PadRight(32), $Detalle) $color
}

Escribir "Diagnóstico de red: $env:COMPUTERNAME ($env:USERNAME), $(Get-Date -Format 'dd/MM/yyyy HH:mm')" 'Cyan'
Escribir ('-' * 72)

# 1. Adaptadores conectados -------------------------------------------------
$adaptadores = Get-NetAdapter | Where-Object Status -eq 'Up'
Resultado 'Adaptador de red conectado' ($adaptadores.Count -gt 0) (($adaptadores.Name) -join ', ')

if (-not $adaptadores) {
    Escribir 'No hay adaptadores conectados. Revisar cable, Wi-Fi o modo avión.' 'Yellow'
}

# 2. Configuración IP -------------------------------------------------------
$config = Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address } | Select-Object -First 1

if ($config) {
    $ip      = $config.IPv4Address.IPAddress
    $gateway = $config.IPv4DefaultGateway.NextHop
    $dns     = ($config.DNSServer | Where-Object AddressFamily -eq 2).ServerAddresses

    Resultado 'Dirección IP válida (no APIPA)' (-not $ip.StartsWith('169.254')) $ip
    Resultado 'Puerta de enlace configurada' ([bool]$gateway) $gateway
    Resultado 'Servidores DNS configurados' ($dns.Count -gt 0) ($dns -join ', ')
} else {
    Resultado 'Configuración IPv4' $false 'Sin dirección IPv4'
}

# 3. Conectividad -----------------------------------------------------------
if ($gateway) {
    $okGw = Test-Connection -ComputerName $gateway -Count 2 -Quiet
    Resultado 'Responde la puerta de enlace' $okGw $gateway
}

$okIp = Test-Connection -ComputerName '8.8.8.8' -Count 2 -Quiet
Resultado 'Salida a internet por IP' $okIp '8.8.8.8'

try {
    $resuelto = Resolve-DnsName -Name 'www.microsoft.com' -Type A -ErrorAction Stop | Where-Object Type -eq 'A' | Select-Object -First 1
    Resultado 'Resolución DNS' $true "www.microsoft.com -> $($resuelto.IPAddress)"
} catch {
    Resultado 'Resolución DNS' $false $_.Exception.Message
}

$https = Test-NetConnection -ComputerName 'www.microsoft.com' -Port 443 -WarningAction SilentlyContinue
Resultado 'Conexión HTTPS (puerto 443)' $https.TcpTestSucceeded

# 4. Proxy ------------------------------------------------------------------
$proxy = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
if ($proxy.ProxyEnable -eq 1) {
    Escribir "Aviso: hay un proxy manual configurado ($($proxy.ProxyServer))." 'Yellow'
}

# 5. Reparación opcional ----------------------------------------------------
if ($Reparar) {
    $esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $esAdmin) {
        Escribir 'Para -Reparar abre PowerShell como administrador.' 'Yellow'
    } else {
        Escribir ''
        Escribir 'Aplicando reparación: vaciar caché DNS y renovar IP...' 'Cyan'
        Clear-DnsClientCache
        ipconfig /release | Out-Null
        ipconfig /renew   | Out-Null
        Escribir 'Listo. Vuelve a ejecutar el script sin -Reparar para verificar.' 'Cyan'
    }
}

# 6. Informe ----------------------------------------------------------------
Escribir ('-' * 72)
$lineas.Add('')
$lineas.Add('=== ipconfig /all ===')
$lineas.AddRange([string[]](ipconfig /all))
$lineas | Out-File -FilePath $informe -Encoding utf8

Write-Host "Informe guardado en: $informe" -ForegroundColor Cyan
