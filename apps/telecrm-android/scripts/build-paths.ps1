# Windows build 출력 경로 (app/build.gradle.kts 와 동일)
function Get-TelecrmAndroidBuildDir {
    Join-Path $env:LOCALAPPDATA "TelecrmAndroidBuild\app"
}

function Get-TelecrmPlayReleaseAabPath {
    $win = Join-Path (Get-TelecrmAndroidBuildDir) "outputs\bundle\playRelease\app-play-release.aab"
    $legacy = Join-Path (Split-Path $PSScriptRoot -Parent) "app\build\outputs\bundle\playRelease\app-play-release.aab"
    if (Test-Path -LiteralPath $win) { return $win }
    if (Test-Path -LiteralPath $legacy) { return $legacy }
    return $win
}
