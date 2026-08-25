$clientId = [System.Guid]::NewGuid().ToString().Substring(0,8)
$cmdFile = Join-Path $env:TEMP "dt-cmd-$clientId.txt"
$resFile = Join-Path $env:TEMP "dt-res-$clientId.txt"

# Signal ready with our clientId
Write-Output "READY:$clientId"
[Console]::Out.Flush()

Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class IH {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, int e);
    [DllImport("user32.dll")] public static extern void keybd_event(byte v, byte s, uint f, int e);
    public const uint LD=0x0002, LU=0x0004, RD=0x0008, RU=0x0010, MD=0x0020, MU=0x0040, WH=0x0800;
    public const uint KU=0x0002;
    public const int VK_CTRL=0x11, VK_ALT=0x12, VK_SHIFT=0x10, VK_WIN=0x5B;
}
"@

function Do-Move($x,$y) { [IH]::SetCursorPos($x,$y) }
function Do-Down($btn) {
    switch($btn){'left'{[IH]::mouse_event([IH]::LD,0,0,0,0)}'right'{[IH]::mouse_event([IH]::RD,0,0,0,0)}'middle'{[IH]::mouse_event([IH]::MD,0,0,0,0)}}
}
function Do-Up($btn) {
    switch($btn){'left'{[IH]::mouse_event([IH]::LU,0,0,0,0)}'right'{[IH]::mouse_event([IH]::RU,0,0,0,0)}'middle'{[IH]::mouse_event([IH]::MU,0,0,0,0)}}
}
function Do-ModDown($k) {
    switch($k){'ctrl'{[IH]::keybd_event([IH]::VK_CTRL,0,0,0)}'control'{[IH]::keybd_event([IH]::VK_CTRL,0,0,0)}'alt'{[IH]::keybd_event([IH]::VK_ALT,0,0,0)}'menu'{[IH]::keybd_event([IH]::VK_ALT,0,0,0)}'shift'{[IH]::keybd_event([IH]::VK_SHIFT,0,0,0)}'win'{[IH]::keybd_event([IH]::VK_WIN,0,0,0)}'lwin'{[IH]::keybd_event([IH]::VK_WIN,0,0,0)}default{$v=[enum]::Parse([System.Windows.Forms.Keys],$k,$true);[IH]::keybd_event([byte]$v,0,0,0)}}
}
function Do-ModUp($k) {
    switch($k){'ctrl'{[IH]::keybd_event([IH]::VK_CTRL,0,[IH]::KU,0)}'control'{[IH]::keybd_event([IH]::VK_CTRL,0,[IH]::KU,0)}'alt'{[IH]::keybd_event([IH]::VK_ALT,0,[IH]::KU,0)}'menu'{[IH]::keybd_event([IH]::VK_ALT,0,[IH]::KU,0)}'shift'{[IH]::keybd_event([IH]::VK_SHIFT,0,[IH]::KU,0)}'win'{[IH]::keybd_event([IH]::VK_WIN,0,[IH]::KU,0)}'lwin'{[IH]::keybd_event([IH]::VK_WIN,0,[IH]::KU,0)}default{$v=[enum]::Parse([System.Windows.Forms.Keys],$k,$true);[IH]::keybd_event([byte]$v,0,[IH]::KU,0)}}
}

while ($true) {
    if (Test-Path $cmdFile) {
        $raw = ''
        try { $raw = Get-Content $cmdFile -Raw -ErrorAction Stop } catch { Start-Sleep -Milliseconds 5; continue }
        try { Remove-Item $cmdFile -Force -ErrorAction Stop } catch {}
        $raw = $raw.Trim()
        if ($raw.Length -eq 0) { continue }

        $parts = $raw -split ' ', 4
        $res = 'OK'
        try {
            switch ($parts[0]) {
                'MOVE'    { Do-Move ([int]$parts[1]) ([int]$parts[2]) }
                'CLICK'   { Do-Move ([int]$parts[1]) ([int]$parts[2]); Start-Sleep -ms 15; Do-Down $parts[3]; Start-Sleep -ms 40; Do-Up $parts[3] }
                'DBLCLICK'{ Do-Move ([int]$parts[1]) ([int]$parts[2]); Start-Sleep -ms 15; Do-Down $parts[3]; Start-Sleep -ms 25; Do-Up $parts[3]; Start-Sleep -ms 40; Do-Down $parts[3]; Start-Sleep -ms 25; Do-Up $parts[3] }
                'SCROLL'  { Do-Move ([int]$parts[1]) ([int]$parts[2]); Start-Sleep -ms 10; [IH]::mouse_event([IH]::WH,0,0,[int]$parts[3],0) }
                'COMBO'   { $keys=$parts[1]-split'\+'; foreach($k in $keys){Do-ModDown $k.ToLower()}; Start-Sleep -ms 30; foreach($k in ($keys|Sort-Object -Desc)){Do-ModUp $k.ToLower()} }
                'SENDKEYS'{ [System.Windows.Forms.SendKeys]::SendWait($parts[1]) }
                'PING'    { $res = 'PONG' }
                'QUIT'    { Set-Content $resFile 'BYE'; exit 0 }
                default   { $res = 'ERROR Unknown' }
            }
        } catch {
            $res = "ERROR $($_.Exception.Message)"
        }
        Set-Content $resFile $res
    }
    Start-Sleep -Milliseconds 8
}
