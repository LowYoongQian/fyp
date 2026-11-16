param([Parameter(Mandatory=$true)][string]$Log)
$ErrorActionPreference='Stop'
$emulator=Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'emulator.exe' -and $_.CommandLine -like '*-avd flutter_emulator*' -and $_.CommandLine -like '*-read-only*'}
if (@($emulator).Count -ne 1) {throw 'Require exactly the audited read-only flutter_emulator; no other device is modified'}
$adb=(Get-Command adb -ErrorAction Stop).Source
if ((& $adb -s emulator-5554 shell getprop ro.kernel.qemu).Trim() -ne '1') {throw 'Refusing a physical device'}
$priorAirplane=(& $adb -s emulator-5554 shell settings get global airplane_mode_on).Trim()
$priorWifi=(& $adb -s emulator-5554 shell settings get global wifi_on).Trim()
$priorData=(& $adb -s emulator-5554 shell settings get global mobile_data).Trim()
$changed=$false
try {
    $deadline=(Get-Date).AddMinutes(3)
    while (-not ((Test-Path -LiteralPath $Log) -and (Select-String -LiteralPath $Log -Pattern '^QA_OFFLINE_READY\s*$' -Quiet))) {
        if ((Get-Date) -gt $deadline) {throw 'Native test did not request network cut within three minutes'}
        Start-Sleep -Seconds 1
    }
    $changed=$true
    & $adb -s emulator-5554 shell svc wifi disable
    & $adb -s emulator-5554 shell svc data disable
    & $adb -s emulator-5554 shell cmd connectivity airplane-mode enable
    Write-Output 'Audited guest network disabled; native test must prove a transport failure'
    $deadline=(Get-Date).AddMinutes(2)
    while (-not (Select-String -LiteralPath $Log -Pattern '^QA_RESTORE_NETWORK\s*$' -Quiet)) {
        if ((Get-Date) -gt $deadline) {throw 'Restore marker missing; restoring original network settings now'}
        Start-Sleep -Seconds 1
    }
} finally {
    if ($changed) {
        if($priorAirplane -eq '1') {& $adb -s emulator-5554 shell cmd connectivity airplane-mode enable}
        else {& $adb -s emulator-5554 shell cmd connectivity airplane-mode disable}
        if($priorWifi -eq '1') {& $adb -s emulator-5554 shell svc wifi enable}
        else {& $adb -s emulator-5554 shell svc wifi disable}
        if($priorData -eq '1') {& $adb -s emulator-5554 shell svc data enable}
        else {& $adb -s emulator-5554 shell svc data disable}
        Write-Output 'Original audited guest network settings restored'
    }
}
