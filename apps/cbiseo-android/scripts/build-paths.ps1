# Windows build 출력 경로 (app/build.gradle.kts 와 동일)
function Get-CbiseoAndroidBuildDir {
    Join-Path $env:LOCALAPPDATA "CbiseoAndroidBuild\app"
}

function Get-CbiseoPlayDebugApkPath {
    $win = Join-Path (Get-CbiseoAndroidBuildDir) "outputs\apk\play\debug\app-play-debug.apk"
    $legacy = Join-Path (Split-Path $PSScriptRoot -Parent) "app\build\outputs\apk\play\debug\app-play-debug.apk"
    if (Test-Path -LiteralPath $win) { return $win }
    if (Test-Path -LiteralPath $legacy) { return $legacy }
    return $win
}

function Get-CbiseoPlayReleaseAabPath {
    $win = Join-Path (Get-CbiseoAndroidBuildDir) "outputs\bundle\playRelease\app-play-release.aab"
    $legacy = Join-Path (Split-Path $PSScriptRoot -Parent) "app\build\outputs\bundle\playRelease\app-play-release.aab"
    if (Test-Path -LiteralPath $win) { return $win }
    if (Test-Path -LiteralPath $legacy) { return $legacy }
    return $win
}
