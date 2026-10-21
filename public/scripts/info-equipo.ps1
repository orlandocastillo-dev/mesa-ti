<#
.SYNOPSIS
    Ficha técnica del equipo para documentar un ticket o un inventario.

.DESCRIPTION
    Reúne en una sola vista los datos que casi siempre se piden al escalar un caso:
    nombre, usuario, modelo, número de serie, sistema operativo, último reinicio,
    procesador, memoria, discos (tipo, salud y espacio libre) y red.
    Puede exportar el resultado a JSON o CSV para un inventario.

.PARAMETER Exportar
    Ruta de un archivo .json o .csv donde guardar la ficha.

.EXAMPLE
    .\info-equipo.ps1
    .\info-equipo.ps1 -Exportar "$env:USERPROFILE\Desktop\ficha.json"
#>
[CmdletBinding()]
param(
    [string]$Exportar
)

$so      = Get-CimInstance Win32_OperatingSystem
$equipo  = Get-CimInstance Win32_ComputerSystem
$bios    = Get-CimInstance Win32_BIOS
$cpu     = Get-CimInstance Win32_Processor | Select-Object -First 1
$red     = Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address } | Select-Object -First 1
$fisicos = Get-PhysicalDisk

$discos = Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | ForEach-Object {
    [pscustomobject]@{
        Unidad      = "$($_.DriveLetter):"
        TamanoGB    = [math]::Round($_.Size / 1GB, 1)
        LibreGB     = [math]::Round($_.SizeRemaining / 1GB, 1)
        LibrePct    = if ($_.Size) { [math]::Round($_.SizeRemaining / $_.Size * 100) } else { 0 }
    }
}

$ficha = [ordered]@{
    Equipo          = $env:COMPUTERNAME
    Usuario         = "$env:USERDOMAIN\$env:USERNAME"
    Fabricante      = $equipo.Manufacturer
    Modelo          = $equipo.Model
    Serie           = $bios.SerialNumber
    SistemaOperativo= "$($so.Caption) ($($so.Version))"
    UltimoReinicio  = $so.LastBootUpTime
    DiasEncendido   = [math]::Round(((Get-Date) - $so.LastBootUpTime).TotalDays, 1)
    Procesador      = $cpu.Name.Trim()
    MemoriaGB       = [math]::Round($equipo.TotalPhysicalMemory / 1GB, 1)
    DiscosFisicos   = ($fisicos | ForEach-Object { "$($_.FriendlyName) [$($_.MediaType), $($_.HealthStatus)]" }) -join '; '
    IP              = $red.IPv4Address.IPAddress
    PuertaEnlace    = $red.IPv4DefaultGateway.NextHop
    MAC             = $red.NetAdapter.MacAddress
}

Write-Host "`nFicha del equipo" -ForegroundColor Cyan
[pscustomobject]$ficha | Format-List

Write-Host 'Volúmenes' -ForegroundColor Cyan
$discos | Format-Table -AutoSize

# Avisos útiles para el diagnóstico
if ($ficha.DiasEncendido -gt 7) {
    Write-Host "Aviso: el equipo lleva $($ficha.DiasEncendido) días sin reiniciar." -ForegroundColor Yellow
}
$discos | Where-Object LibrePct -lt 15 | ForEach-Object {
    Write-Host "Aviso: la unidad $($_.Unidad) tiene solo $($_.LibrePct) % libre." -ForegroundColor Yellow
}
$fisicos | Where-Object HealthStatus -ne 'Healthy' | ForEach-Object {
    Write-Host "Alerta: el disco $($_.FriendlyName) reporta estado $($_.HealthStatus). Respaldar datos." -ForegroundColor Red
}

if ($Exportar) {
    $salida = [pscustomobject]$ficha
    $salida | Add-Member -NotePropertyName Volumenes -NotePropertyValue (($discos | ForEach-Object { "$($_.Unidad) $($_.LibreGB)/$($_.TamanoGB) GB" }) -join '; ')
    switch ([IO.Path]::GetExtension($Exportar).ToLower()) {
        '.csv'  { $salida | Export-Csv -Path $Exportar -NoTypeInformation -Encoding UTF8 }
        default { $salida | ConvertTo-Json | Out-File -FilePath $Exportar -Encoding utf8 }
    }
    Write-Host "Ficha exportada a $Exportar" -ForegroundColor Cyan
}
