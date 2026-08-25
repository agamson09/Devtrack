@echo off
cd /d "%~dp0"
echo Compiling DevTrackAgent.exe...
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:exe /out:DevTrackAgent.exe /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll /reference:System.ServiceProcess.dll /reference:System.Configuration.Install.dll /reference:System.Net.dll Agent.cs
if %ERRORLEVEL% EQU 0 (
    echo BUILD SUCCESS!
    echo DevTrackAgent.exe is ready.
) else (
    echo BUILD FAILED!
)
