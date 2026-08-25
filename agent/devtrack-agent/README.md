# DevTrack Remote Agent v4.0

Standalone EXE agent untuk remote desktop - seperti AnyDesk!

## Download

Download dari server: `http://your-server:3000/api/remote/download-agent`

## Cara Pakai

### Simple (double-click)
```
DevTrackAgent.exe
```

### Dengan opsi
```
DevTrackAgent.exe --server http://your-server:3000 --name "My PC" --fps 15 --quality 50
```

### Opsi
| Flag | Default | Description |
|------|---------|-------------|
| `--server` | http://localhost:3000 | Server URL |
| `--name` | (hostname) | Device name |
| `--password` | (empty) | Agent password |
| `--fps` | 15 | Max framerate |
| `--quality` | 50 | JPEG quality (1-100) |

## Features

- ✅ Single EXE - tidak perlu install Node.js
- ✅ Works headless - pakai VDD (Virtual Display Driver)
- ✅ Remote mouse & keyboard
- ✅ Auto-reconnect
- ✅ Tidak di-block antivirus (native C#)

## Requirements

- Windows 7/8/10/11
- .NET Framework 4.0+ (sudah ada di Windows 10/11)
- Koneksi internet ke server

## Troubleshooting

### "PrintWindow returned false"
- Install Virtual Display Driver (VDD)
- Atau jalankan via RDP dulu

### "Connection failed"
- Cek firewall - pastikan port 443 (HTTPS) terbuka
- Cek koneksi internet

### Screen hitam
- Install VDD: https://github.com/VirtualDrivers/Virtual-Display-Driver
- Atau pakai HDMI Dummy Plug

## Service Mode (Optional)

Untuk jalankan sebagai Windows Service, gunakan NSSM:
```
nssm install DevTrackAgent "C:\path\to\DevTrackAgent.exe"
nssm start DevTrackAgent
```
