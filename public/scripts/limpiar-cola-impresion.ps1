<#
.SYNOPSIS
    Limpia la cola de impresión cuando hay trabajos atascados.

.DESCRIPTION
    Detiene el servicio Spooler, borra los archivos temporales de los trabajos en cola
    y vuelve a iniciar el servicio. Muestra cuántos trabajos se eliminaron.
    Equivale a los pasos 2 a 4 de la guía 03.

.EXAMPLE
    .\limpiar-cola-impresion.ps1

.NOTES
    Requiere PowerShell como administrador. Los documentos en cola se pierden: avisar al usuario.
#>
#Requires -RunAsAdministrator
[CmdletBinding(SupportsShouldProcess)]
param()

$carpeta = Join-Path $env:SystemRoot 'System32\spool\PRINTERS'

$trabajos = Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue }
Write-Host ("Trabajos en cola antes de limpiar: {0}" -f @($trabajos).Count)

if ($PSCmdlet.ShouldProcess('Servicio Spooler', 'Detener, limpiar y reiniciar')) {
    Write-Host 'Deteniendo el servicio de Cola de impresión...'
    Stop-Service -Name Spooler -Force -ErrorAction Stop

    # Espera a que el servicio libere los archivos.
    (Get-Service -Name Spooler).WaitForStatus('Stopped', '00:00:15')

    $archivos = Get-ChildItem -Path $carpeta -File -ErrorAction SilentlyContinue
    $archivos | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host ("Archivos temporales eliminados: {0}" -f @($archivos).Count)

    Write-Host 'Iniciando el servicio...'
    Start-Service -Name Spooler -ErrorAction Stop

    $estado = (Get-Service -Name Spooler).Status
    if ($estado -eq 'Running') {
        Write-Host 'Cola de impresión limpia y servicio en ejecución. Imprime una página de prueba.' -ForegroundColor Green
    } else {
        Write-Host "El servicio quedó en estado $estado. Revisar el Visor de eventos > PrintService." -ForegroundColor Red
    }
}
