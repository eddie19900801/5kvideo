param([Parameter(Mandatory=$true)][string]$ChannelCode,[string]$ProductSlug="ppfree",[string]$ProductName="PP免费",[string]$ProductPackage="cn.ppfree.video",[string]$ProductDomain="5knews.wflhc.cn",[string]$ApiBase="https://897kg.cc/vdo/api/v1",[string]$OutputDirectory="")
$ErrorActionPreference="Stop"
$OutputDirectory=if($OutputDirectory){$OutputDirectory}else{Join-Path $PSScriptRoot "dist"}
$project=Join-Path $PSScriptRoot "android"
$env:JAVA_HOME=(Get-ChildItem "E:\5kvideo\.android-build\jdk" -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME="E:\5kvideo\.android-build\sdk"
$gradle="E:\5kvideo\.android-build\gradle\gradle-8.9\bin\gradle.bat"
& $gradle -p $project :app:assembleRelease "-PchannelCode=$ChannelCode" "-PproductSlug=$ProductSlug" "-PproductName=$ProductName" "-PproductPackage=$ProductPackage" "-PproductDomain=$ProductDomain" "-PapiBase=$ApiBase"
if($LASTEXITCODE -ne 0){throw "Android build failed"}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$target=Join-Path $OutputDirectory "$ProductSlug-$ChannelCode.apk"
Copy-Item -Force (Join-Path $project "app\build\outputs\apk\release\app-release.apk") $target
Write-Output $target
