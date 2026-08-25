using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Configuration.Install;
using System.Windows.Forms;

namespace DevTrack.Agent
{
    class Program
    {
        // Win32 API - Screen Capture
        [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
        [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
        [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
        [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleBitmap(IntPtr dc, int width, int height);
        [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);
        [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr dst, int x, int y, int cx, int cy, IntPtr src, int x1, int y1, uint rop);
        [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
        [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
        [DllImport("user32.dll")] static extern int GetSystemMetrics(int nIndex);
        [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

        // Win32 API - Input Simulation
        [DllImport("user32.dll")] static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);
        [DllImport("user32.dll")] static extern bool SetCursorPos(int X, int Y);
        [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

        const uint SRCCOPY = 0x00CC0020;
        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint KEYEVENTF_KEYUP = 0x0002;

        static string ServerUrl = "http://localhost:3000";
        static string DeviceName = Environment.MachineName;
        static string DeviceId = null;  // Persistent unique device ID (AnyDesk-style)
        static string DevicePassword = "";
        static string DeviceApiKey = "";
        static int MaxFPS = 15;
        static int Quality = 50;
        static bool Running = true;
        static string SessionId = null;
        static string SessionApiKey = null;
        static string ViewerId = null;
        static bool Streaming = false;
        static bool KeepAlive = true;
        static JavaScriptSerializer Json = new JavaScriptSerializer();

        // ==================== UI THREAD ====================
        static Thread uiThread;
        static DeviceInfoForm deviceInfoForm;
        static ManualResetEvent uiReady = new ManualResetEvent(false);

        static void StartUiThread()
        {
            uiThread = new Thread(() =>
            {
                deviceInfoForm = new DeviceInfoForm(DeviceId, DevicePassword);
                deviceInfoForm.Show();
                uiReady.Set();
                Application.Run();
            });
            uiThread.IsBackground = true;
            uiThread.SetApartmentState(ApartmentState.STA);
            uiThread.Start();
            uiReady.WaitOne(3000);
        }

        // ==================== SERVICE MODE ====================
        static ManualResetEvent stopEvent = new ManualResetEvent(false);
        static bool isServiceMode = false;

        static void Main(string[] args)
        {
            // Check for --install / --uninstall flags
            if (args.Length > 0)
            {
                if (args[0] == "--install")
                {
                    InstallService();
                    return;
                }
                if (args[0] == "--uninstall")
                {
                    UninstallService();
                    return;
                }
            }

            // Detect service mode: if --service flag OR not interactive (launched by SCM)
            isServiceMode = Array.Exists(args, a => a == "--service") || !Environment.UserInteractive;

            if (isServiceMode)
            {
                // Run as Windows Service
                ServiceBase.Run(new DevTrackService());
            }
            else
            {
                // Run as console (for debugging)
                Console.Title = "DevTrack Agent v5.0";
                SetProcessDPIAware();
                Json.MaxJsonLength = int.MaxValue;
                RunAgent(args);
            }
        }

        static void RunAgent(string[] args)
        {
            SetProcessDPIAware();
            Json.MaxJsonLength = int.MaxValue;

            // Enable TLS 1.2 for .NET 4.0 on older Windows
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
            }
            catch { }
            ServicePointManager.DefaultConnectionLimit = 10;

            // Load config from agent-config.json (next to exe)
            LoadConfig();

            // Parse args (override config file)
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--server" && i + 1 < args.Length) ServerUrl = args[++i];
                if (args[i] == "--name" && i + 1 < args.Length) DeviceName = args[++i];
                if (args[i] == "--password" && i + 1 < args.Length) DevicePassword = args[++i];
                if (args[i] == "--fps" && i + 1 < args.Length) int.TryParse(args[++i], out MaxFPS);
                if (args[i] == "--quality" && i + 1 < args.Length) int.TryParse(args[++i], out Quality);
                if (args[i] == "--apikey" && i + 1 < args.Length) DeviceApiKey = args[++i];
                if (args[i] == "--no-keepalive") KeepAlive = false;
            }

            // Get local IP
            string localIP = GetLocalIP();
            int screenW = GetSystemMetrics(0);
            int screenH = GetSystemMetrics(1);
            if (screenW <= 0) screenW = 1920;
            if (screenH <= 0) screenH = 1080;

            PrintBanner(localIP, screenW, screenH);

            // Start UI thread (DeviceInfoForm)
            if (!isServiceMode)
            {
                try { StartUiThread(); }
                catch (Exception ex) { Console.WriteLine("[ui] Failed to start: " + ex.Message); }
            }

            // Keep session alive after RDP disconnect
            if (KeepAlive)
            {
                KeepSessionAlive();
            }

            // Register with server
            Console.WriteLine("[agent] Registering...");
            try
            {
                var regData = new Dictionary<string, object>
                {
                    { "name", DeviceName }, { "os", "win32" },
                    { "osVersion", Environment.OSVersion.ToString() },
                    { "ip", localIP }, { "hostname", Environment.MachineName },
                    { "deviceId", DeviceId },
                    { "resolution", new Dictionary<string, int> { { "width", screenW }, { "height", screenH } } },
                    { "agentVersion", "6.0.0" }, { "password", DevicePassword }, { "devicePassword", DevicePassword }
                };

                // Include API key if provided
                if (!string.IsNullOrEmpty(DeviceApiKey))
                    regData["apiKey"] = DeviceApiKey;

                string response = HttpPost(ServerUrl + "/api/remote/register", Json.Serialize(regData));
                Console.WriteLine("[agent] Register response: " + response.Substring(0, Math.Min(response.Length, 200)));
                var result = Json.Deserialize<Dictionary<string, object>>(response);
                if (result.ContainsKey("sessionId"))
                {
                    SessionId = result["sessionId"].ToString();
                    if (result.ContainsKey("apiKey"))
                        SessionApiKey = result["apiKey"].ToString();
                    Console.WriteLine("[agent] Registered! ID: " + SessionId);
                }
                else if (result.ContainsKey("error"))
                {
                    Console.WriteLine("[agent] Registration rejected: " + result["error"].ToString());
                }
                else
                {
                    Console.WriteLine("[agent] Registration failed: unexpected response");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[agent] Registration failed: " + ex.Message);
                Console.WriteLine("[agent] Will keep trying...");
            }

            // Background threads
            Thread heartbeatThread = new Thread(() => { while (Running) { SendHeartbeat(); Thread.Sleep(5000); } });
            heartbeatThread.IsBackground = true;
            heartbeatThread.Start();

            Thread captureThread = new Thread(() => { while (Running) { CaptureAndSend(); Thread.Sleep(1000 / MaxFPS); } });
            captureThread.IsBackground = true;
            captureThread.Start();

            Thread commandThread = new Thread(() => { while (Running) { PollCommands(); Thread.Sleep(200); } });
            commandThread.IsBackground = true;
            commandThread.Start();

            Console.WriteLine("[agent] Ready! Waiting for connections...");
            Console.WriteLine("[agent] Press Ctrl+C to exit");

            Console.CancelKeyPress += (s, e) => { e.Cancel = true; Running = false; Shutdown(); };

            while (Running) Thread.Sleep(100);
            Shutdown();
        }

        // ==================== CONFIG ENCRYPTION ====================
        // AES-256-CBC encryption for password in agent-config.json
        // Key is derived from DeviceId + machine hostname (machine-bound)
        static string GetConfigKey()
        {
            // Use DeviceId + MachineName as key material
            string raw = (DeviceId ?? Environment.MachineName) + "DevTrack-Agent-Salt-2024";
            using (var sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
                return Convert.ToBase64String(hash);
            }
        }

        static string EncryptPassword(string plain)
        {
            if (string.IsNullOrEmpty(plain)) return "";
            try
            {
                byte[] key = Convert.FromBase64String(GetConfigKey());
                byte[] iv = new byte[16];
                using (var rng = new RNGCryptoServiceProvider())
                    rng.GetBytes(iv);

                using (var aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;
                    aes.Mode = CipherMode.CBC;
                    aes.Padding = PaddingMode.PKCS7;
                    using (var encryptor = aes.CreateEncryptor())
                    {
                        byte[] plainBytes = Encoding.UTF8.GetBytes(plain);
                        byte[] encrypted = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);
                        return "enc:" + Convert.ToBase64String(iv) + ":" + Convert.ToBase64String(encrypted);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[config] Encrypt failed: " + ex.Message);
                return plain;
            }
        }

        static string DecryptPassword(string cipher)
        {
            if (string.IsNullOrEmpty(cipher)) return "";
            // Backward compat: if not encrypted, return as-is
            if (!cipher.StartsWith("enc:")) return cipher;
            try
            {
                string[] parts = cipher.Substring(4).Split(':');
                if (parts.Length != 2) return cipher;
                byte[] iv = Convert.FromBase64String(parts[0]);
                byte[] encrypted = Convert.FromBase64String(parts[1]);
                byte[] key = Convert.FromBase64String(GetConfigKey());

                using (var aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;
                    aes.Mode = CipherMode.CBC;
                    aes.Padding = PaddingMode.PKCS7;
                    using (var decryptor = aes.CreateDecryptor())
                    {
                        byte[] decrypted = decryptor.TransformFinalBlock(encrypted, 0, encrypted.Length);
                        return Encoding.UTF8.GetString(decrypted);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[config] Decrypt failed: " + ex.Message);
                return cipher;
            }
        }

        static string GetConfigPath()
        {
            string exeDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
            string configPath = Path.Combine(exeDir, "agent-config.json");
            if (File.Exists(configPath)) return configPath;
            configPath = Path.Combine(exeDir, "..", "agent-config.json");
            if (File.Exists(configPath)) return configPath;
            return Path.Combine(exeDir, "agent-config.json");
        }

        static void SaveConfig()
        {
            try
            {
                string configPath = GetConfigPath();
                var config = new Dictionary<string, object>
                {
                    { "server", ServerUrl },
                    { "name", DeviceName },
                    { "deviceId", DeviceId },
                    { "password", EncryptPassword(DevicePassword) },
                    { "maxFPS", MaxFPS },
                    { "captureQuality", Quality },
                    { "headless", !KeepAlive },
                    { "autoReconnect", true }
                };
                File.WriteAllText(configPath, Json.Serialize(config));
                Console.WriteLine("[config] Saved to " + configPath);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[config] Could not save config: " + ex.Message);
            }
        }

        static void LoadConfig()
        {
            try
            {
                string configPath = GetConfigPath();
                if (!File.Exists(configPath))
                {
                    // First run: generate DeviceId and random password
                    DeviceId = GenerateDeviceId();
                    DevicePassword = GenerateRandomPassword(16);
                    Console.WriteLine("[config] First run! Generated Device ID: " + DeviceId);
                    Console.WriteLine("[config] Generated random password: " + DevicePassword);
                    SaveConfig();
                    return;
                }

                string json = File.ReadAllText(configPath);
                var config = Json.Deserialize<Dictionary<string, object>>(json);
                if (config == null) return;

                if (config.ContainsKey("server") && config["server"] != null)
                    ServerUrl = config["server"].ToString();
                if (config.ContainsKey("name") && config["name"] != null)
                    DeviceName = config["name"].ToString();
                if (config.ContainsKey("deviceId") && config["deviceId"] != null)
                    DeviceId = config["deviceId"].ToString();
                if (config.ContainsKey("password") && config["password"] != null)
                    DevicePassword = DecryptPassword(config["password"].ToString());
                if (config.ContainsKey("apikey") && config["apikey"] != null)
                    DeviceApiKey = config["apikey"].ToString();
                if (config.ContainsKey("maxFPS") && config["maxFPS"] != null)
                    int.TryParse(config["maxFPS"].ToString(), out MaxFPS);
                if (config.ContainsKey("captureQuality") && config["captureQuality"] != null)
                    int.TryParse(config["captureQuality"].ToString(), out Quality);
                if (config.ContainsKey("headless"))
                    KeepAlive = config["headless"].ToString().ToLower() != "true";

                // If no DeviceId yet (migration), generate and save
                if (string.IsNullOrEmpty(DeviceId))
                {
                    DeviceId = GenerateDeviceId();
                    Console.WriteLine("[config] Migrated! Generated Device ID: " + DeviceId);
                    SaveConfig();
                }

                // Re-encrypt password if stored as plaintext (migration)
                if (!string.IsNullOrEmpty(DevicePassword) && config.ContainsKey("password"))
                {
                    string stored = config["password"].ToString();
                    if (!stored.StartsWith("enc:"))
                    {
                        Console.WriteLine("[config] Migrating plaintext password to encrypted...");
                        SaveConfig();
                    }
                }

                Console.WriteLine("[config] Config loaded from agent-config.json");
                Console.WriteLine("[config] Device ID: " + DeviceId);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[config] Could not load config: " + ex.Message);
                DeviceId = GenerateDeviceId();
            }
        }

        // Generate persistent Device ID based on MAC address
        static string GenerateDeviceId()
        {
            try
            {
                // Try to get MAC address for stable ID
                var nic = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()
                    .FirstOrDefault(n => n.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up
                                     && n.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback);
                if (nic != null)
                {
                    string mac = nic.GetPhysicalAddress().ToString();
                    // Format as AnyDesk-style: XXX XXX XXX
                    if (mac.Length >= 12)
                    {
                        string id = mac.Substring(0, 3) + " " + mac.Substring(3, 3) + " " + mac.Substring(6, 3);
                        Console.WriteLine("[config] Device ID from MAC: " + id);
                        return id;
                    }
                }
            }
            catch { }
            // Fallback: random GUID
            return Guid.NewGuid().ToString("N").Substring(0, 9).ToUpper();
        }

        // Generate random password for unattended access
        static string GenerateRandomPassword(int length)
        {
            string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
            StringBuilder sb = new StringBuilder();
            using (var rng = new RNGCryptoServiceProvider())
            {
                byte[] data = new byte[length];
                rng.GetBytes(data);
                for (int i = 0; i < length; i++)
                {
                    sb.Append(chars[data[i] % chars.Length]);
                }
            }
            return sb.ToString();
        }

        static void PrintBanner(string ip, int w, int h)
        {
            Console.WriteLine("==========================================");                Console.WriteLine("  DevTrack Remote Agent v6.0 (C#)");
            Console.WriteLine("==========================================");                Console.WriteLine("Server:    " + ServerUrl);
                Console.WriteLine("Device:    " + DeviceName);
                Console.WriteLine("Device ID: " + DeviceId);
                Console.WriteLine("Password:  " + DevicePassword);
                Console.WriteLine("OS:        " + Environment.OSVersion);
                Console.WriteLine("IP:        " + ip);
                Console.WriteLine("Screen:    " + w + "x" + h);
                Console.WriteLine("FPS:       " + MaxFPS + " | Quality: " + Quality);
                Console.WriteLine("==========================================");
        }

        static void KeepSessionAlive()
        {
            try
            {
                // Get current session ID
                Process proc = new Process();
                proc.StartInfo.FileName = "query";
                proc.StartInfo.Arguments = "session";
                proc.StartInfo.RedirectStandardOutput = true;
                proc.StartInfo.UseShellExecute = false;
                proc.StartInfo.CreateNoWindow = true;
                proc.Start();
                string output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit();

                // Parse session ID from 'query session' output
                string sessionId = null;
                foreach (string line in output.Split('\n'))
                {
                    if (line.Contains("rdp-tcp") && line.Contains("Active"))
                    {
                        // Format: SESSIONNAME  USERNAME  ID  STATE  TYPE  DEVICE
                        string[] parts = line.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        for (int i = 0; i < parts.Length; i++)
                        {
                            int id;
                            if (int.TryParse(parts[i], out id))
                            {
                                sessionId = parts[i];
                                break;
                            }
                        }
                        break;
                    }
                }

                if (sessionId != null)
                {
                    Console.WriteLine("[agent] Current RDP session ID: " + sessionId);
                    Console.WriteLine("[agent] Moving session to console (keep-alive)...");

                    // Run tscon to move session to console
                    Process tscon = new Process();
                    tscon.StartInfo.FileName = "tscon";
                    tscon.StartInfo.Arguments = sessionId + " /dest:console";
                    tscon.StartInfo.UseShellExecute = false;
                    tscon.StartInfo.CreateNoWindow = true;
                    tscon.Start();
                    tscon.WaitForExit();

                    Console.WriteLine("[agent] Session moved to console. RDP can be safely disconnected.");
                }
                else
                {
                    Console.WriteLine("[agent] No active RDP session found. Running in direct mode.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[agent] Keep-alive warning: " + ex.Message);
                Console.WriteLine("[agent] Session may disconnect when RDP is closed.");
            }
        }

        static string GetLocalIP()
        {
            try
            {
                using (Socket s = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0))
                {
                    s.Connect("8.8.8.8", 80);
                    IPEndPoint ep = s.LocalEndPoint as IPEndPoint;
                    return ep != null ? ep.Address.ToString() : "127.0.0.1";
                }
            }
            catch { return "127.0.0.1"; }
        }

        static int consecutiveFailures = 0;

        static void SendHeartbeat()
        {
            // Auto-reconnect: if not registered, try to re-register
            if (string.IsNullOrEmpty(SessionId))
            {
                TryRegister();
                return;
            }
            try
            {
                var data = new Dictionary<string, object> { { "sessionId", SessionId }, { "status", "online" }, { "apiKey", SessionApiKey } };
                string resp = HttpPost(ServerUrl + "/api/remote/heartbeat", Json.Serialize(data));
                consecutiveFailures = 0;
            }
            catch
            {
                consecutiveFailures++;
                if (consecutiveFailures >= 3)
                {
                    Console.WriteLine("[agent] Heartbeat failed " + consecutiveFailures + " times, re-registering...");
                    SessionId = null;
                    SessionApiKey = null;
                    TryRegister();
                }
            }
        }

        static void TryRegister()
        {
            try
            {
                string localIP = GetLocalIP();
                int screenW = GetSystemMetrics(0);
                int screenH = GetSystemMetrics(1);
                if (screenW <= 0) screenW = 1920;
                if (screenH <= 0) screenH = 1080;

                var regData = new Dictionary<string, object>
                {
                    { "name", DeviceName }, { "os", "win32" },
                    { "osVersion", Environment.OSVersion.ToString() },
                    { "ip", localIP }, { "hostname", Environment.MachineName },
                    { "deviceId", DeviceId },
                    { "resolution", new Dictionary<string, int> { { "width", screenW }, { "height", screenH } } },
                    { "agentVersion", "6.0.0" }, { "password", DevicePassword }, { "devicePassword", DevicePassword }
                };
                if (!string.IsNullOrEmpty(DeviceApiKey))
                    regData["apiKey"] = DeviceApiKey;

                string response = HttpPost(ServerUrl + "/api/remote/register", Json.Serialize(regData));
                var result = Json.Deserialize<Dictionary<string, object>>(response);
                if (result.ContainsKey("sessionId"))
                {
                    SessionId = result["sessionId"].ToString();
                    if (result.ContainsKey("apiKey"))
                        SessionApiKey = result["apiKey"].ToString();
                    Console.WriteLine("[agent] Re-registered! Device ID: " + DeviceId + " Session: " + SessionId);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[agent] Re-register failed: " + ex.Message);
            }
        }

        static void PollCommands()
        {
            if (string.IsNullOrEmpty(SessionId)) return;
            try
            {
                string response = HttpGet(ServerUrl + "/api/remote/commands/" + SessionId);
                if (string.IsNullOrEmpty(response) || response == "[]") return;

                var commands = Json.Deserialize<List<Dictionary<string, object>>>(response);
                foreach (var cmd in commands) ProcessCommand(cmd);
            }
            catch { }
        }

        static void ProcessCommand(Dictionary<string, object> cmd)
        {
            if (!cmd.ContainsKey("type")) return;
            string type = cmd["type"].ToString();

            switch (type)
            {
                case "start":
                    string viewerId = cmd.ContainsKey("viewerId") ? cmd["viewerId"].ToString() : "web";
                    Console.WriteLine("[stream] Started by: " + viewerId);
                    ViewerId = viewerId;
                    Streaming = true;
                    break;
                case "stop":
                    Console.WriteLine("[stream] Stopped");
                    Streaming = false;
                    ViewerId = null;
                    break;
                case "mouse":
                    SimulateMouse(cmd);
                    break;
                case "keyboard":
                    SimulateKeyboard(cmd);
                    break;
                case "approval_request":
                    HandleApprovalRequest(cmd);
                    break;
                case "clipboard-set":
                    HandleClipboardSet(cmd);
                    break;
                case "clipboard-get":
                    HandleClipboardGet();
                    break;
                case "file-chunk":
                    HandleFileChunk(cmd);
                    break;
            }
        }

        // ==================== APPROVAL FLOW ====================
        // For unattended access without password - shows WinForms dialog to approve/reject
        static void HandleApprovalRequest(Dictionary<string, object> cmd)
        {
            string viewerName = cmd.ContainsKey("viewerName") ? cmd["viewerName"].ToString() : "Unknown";
            string message = cmd.ContainsKey("message") ? cmd["message"].ToString() : "Remote connection requested";
            string viewerId = cmd.ContainsKey("viewerId") ? cmd["viewerId"].ToString() : null;

            Console.WriteLine("[approval] " + message);

            // In service mode or no UI thread: auto-approve
            if (isServiceMode || uiThread == null || !uiThread.IsAlive)
            {
                Console.WriteLine("[approval] Auto-approving (no UI available)...");
                SendApprovalResponse(viewerId, true);
                return;
            }

            // Show WinForms approval dialog on UI thread
            try
            {
                bool approved = false;
                ApprovalRequestForm form = null;
                deviceInfoForm.Invoke(new MethodInvoker(delegate { form = new ApprovalRequestForm(viewerName, message); }));
                deviceInfoForm.Invoke(new MethodInvoker(delegate { approved = form.ShowDialog() == DialogResult.OK; }));
                SendApprovalResponse(viewerId, approved);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[approval] UI error: " + ex.Message + ", auto-rejecting");
                SendApprovalResponse(viewerId, false);
            }
        }

        static void SendApprovalResponse(string viewerId, bool approved)
        {
            if (string.IsNullOrEmpty(viewerId)) return;
            try
            {
                var data = new Dictionary<string, object>
                {
                    { "sessionId", SessionId },
                    { "viewerId", viewerId },
                    { "approved", approved }
                };
                HttpPost(ServerUrl + "/api/remote/approve", Json.Serialize(data));
                Console.WriteLine("[approval] " + (approved ? "Approved" : "Rejected"));
            }
            catch (Exception ex)
            {
                Console.WriteLine("[approval] Failed to send response: " + ex.Message);
            }
        }

        static void SimulateMouse(Dictionary<string, object> cmd)
        {
            if (!cmd.ContainsKey("x") || !cmd.ContainsKey("y") || !cmd.ContainsKey("action")) return;
            int x = Convert.ToInt32(Math.Round(Convert.ToDouble(cmd["x"])));
            int y = Convert.ToInt32(Math.Round(Convert.ToDouble(cmd["y"])));
            string action = cmd["action"].ToString();

            int screenW = GetSystemMetrics(0);
            int screenH = GetSystemMetrics(1);
            if (x <= 1 && y <= 1) { x = (int)(x * screenW); y = (int)(y * screenH); }

            SetCursorPos(x, y);
            switch (action)
            {
                case "click": // mousedown (button press only, for drag support)
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
                    break;
                case "release": // mouseup (button release)
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
                    break;
                case "rightclick": // right mousedown
                    mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, IntPtr.Zero);
                    break;
                case "rightclick-release": // right mouseup
                    mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, IntPtr.Zero);
                    break;
                case "doubleclick":
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
                    Thread.Sleep(50);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
                    break;
                case "move":
                    SetCursorPos(x, y);
                    break;
                case "scroll":
                    int delta = cmd.ContainsKey("delta") ? Convert.ToInt32(cmd["delta"]) : 120;
                    mouse_event(0x0800, 0, 0, delta, IntPtr.Zero);
                    break;
            }
        }

        static void SimulateKeyboard(Dictionary<string, object> cmd)
        {
            if (!cmd.ContainsKey("key")) return;
            string key = cmd["key"].ToString().ToLower();
            bool ctrl = cmd.ContainsKey("ctrl") && Convert.ToBoolean(cmd["ctrl"]);
            bool alt = cmd.ContainsKey("alt") && Convert.ToBoolean(cmd["alt"]);
            bool shift = cmd.ContainsKey("shift") && Convert.ToBoolean(cmd["shift"]);

            byte vk = GetVirtualKey(key);
            if (vk == 0) return;

            if (shift) keybd_event(0x10, 0, 0, IntPtr.Zero);
            if (ctrl) keybd_event(0x11, 0, 0, IntPtr.Zero);
            if (alt) keybd_event(0x12, 0, 0, IntPtr.Zero);

            keybd_event(vk, 0, 0, IntPtr.Zero);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, IntPtr.Zero);

            if (alt) keybd_event(0x12, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
            if (ctrl) keybd_event(0x11, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
            if (shift) keybd_event(0x10, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
        }

        static byte GetVirtualKey(string key)
        {
            switch (key)
            {
                case "enter": return 0x0D;
                case "tab": return 0x09;
                case "escape": case "esc": return 0x1B;
                case "backspace": return 0x08;
                case "delete": case "del": return 0x2E;
                case "space": return 0x20;
                case "arrowup": return 0x26;
                case "arrowdown": return 0x28;
                case "arrowleft": return 0x25;
                case "arrowright": return 0x27;
                case "home": return 0x24;
                case "end": return 0x23;
                case "pageup": return 0x21;
                case "pagedown": return 0x22;
                case "insert": return 0x2D;
                case "capslock": return 0x14;
                case "numlock": return 0x90;
                case "printscreen": return 0x2C;
                case ".": return 0xBE;
                case ",": return 0xBC;
                case ";": return 0xBA;
                case "'": return 0xDE;
                case "[": return 0xDB;
                case "]": return 0xDC;
                case "\\": return 0xDC; // backslash
                case "/": return 0xBF;
                case "-": return 0xBD;
                case "=": return 0xBB;
                case "`": return 0xC0;
                case "f1": return 0x70;
                case "f2": return 0x71;
                case "f3": return 0x72;
                case "f4": return 0x73;
                case "f5": return 0x74;
                case "f6": return 0x75;
                case "f7": return 0x76;
                case "f8": return 0x77;
                case "f9": return 0x78;
                case "f10": return 0x79;
                case "f11": return 0x7A;
                case "f12": return 0x7B;
                default:
                    if (key.Length == 1) return (byte)char.ToUpper(key[0]);
                    return 0;
            }
        }

        static void CaptureAndSend()
        {
            if (!Streaming || string.IsNullOrEmpty(SessionId) || string.IsNullOrEmpty(ViewerId)) return;
            try
            {
                byte[] jpeg = CaptureScreen();
                if (jpeg == null || jpeg.Length < 100) return;

                var data = new Dictionary<string, object>
                {
                    { "sessionId", SessionId }, { "viewerId", ViewerId },
                    { "frame", Convert.ToBase64String(jpeg) },
                    { "ts", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() },
                    { "size", jpeg.Length }
                };
                HttpPost(ServerUrl + "/api/remote/frame", Json.Serialize(data));
            }
            catch { }
        }

        static byte[] CaptureScreen()
        {
            int w = GetSystemMetrics(0);
            int h = GetSystemMetrics(1);
            if (w <= 0) w = 1920;
            if (h <= 0) h = 1080;

            IntPtr hdcScreen = GetDC(IntPtr.Zero);
            if (hdcScreen == IntPtr.Zero) return null;

            IntPtr memDC = CreateCompatibleDC(hdcScreen);
            IntPtr hBmp = CreateCompatibleBitmap(hdcScreen, w, h);
            IntPtr oldObj = SelectObject(memDC, hBmp);

            bool ok = BitBlt(memDC, 0, 0, w, h, hdcScreen, 0, 0, SRCCOPY);
            SelectObject(memDC, oldObj);

            byte[] result = null;
            if (ok)
            {
                try
                {
                    using (Bitmap bmp = Image.FromHbitmap(hBmp))
                    using (MemoryStream ms = new MemoryStream())
                    {
                        ImageCodecInfo jpegCodec = null;
                        foreach (ImageCodecInfo codec in ImageCodecInfo.GetImageEncoders())
                            if (codec.MimeType == "image/jpeg") { jpegCodec = codec; break; }

                        if (jpegCodec != null)
                        {
                            EncoderParameters eps = new EncoderParameters(1);
                            eps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)Quality);
                            bmp.Save(ms, jpegCodec, eps);
                        }
                        else bmp.Save(ms, ImageFormat.Jpeg);

                        result = ms.ToArray();
                    }
                }
                catch { }
            }

            DeleteObject(hBmp);
            DeleteDC(memDC);
            ReleaseDC(IntPtr.Zero, hdcScreen);
            return result;
        }

        static bool ValidateCertificate(object sender, System.Security.Cryptography.X509Certificates.X509Certificate certificate, System.Security.Cryptography.X509Certificates.X509Chain chain, System.Net.Security.SslPolicyErrors sslPolicyErrors)
        {
            // Accept if no errors
            if (sslPolicyErrors == System.Net.Security.SslPolicyErrors.None) return true;

            // Allow self-signed certs only for local/private network IPs
            try
            {
                Uri uri = sender as Uri ?? new Uri(((HttpWebRequest)sender).RequestUri.ToString());
                string host = uri.Host;
                // Allow for localhost and private IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
                if (host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0") return true;
                if (host.StartsWith("192.168.")) return true;
                if (host.StartsWith("10.")) return true;
                if (host.StartsWith("172."))
                {
                    string[] parts = host.Split('.');
                    if (parts.Length >= 2)
                    {
                        int second;
                        if (int.TryParse(parts[1], out second) && second >= 16 && second <= 31) return true;
                    }
                }
            }
            catch { }

            try {
                string host = "";
                if (sender is HttpWebRequest) host = ((HttpWebRequest)sender).RequestUri.Host;
                else if (sender is Uri) host = ((Uri)sender).Host;
                Console.WriteLine("[http] WARNING: SSL certificate error for " + host);
            } catch { Console.WriteLine("[http] WARNING: SSL certificate error"); }
            return false;
        }

        static string HttpPost(string url, string json)
        {
            try
            {
                ServicePointManager.ServerCertificateValidationCallback = ValidateCertificate;

                byte[] data = Encoding.UTF8.GetBytes(json);
                WebRequest req = WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json";
                req.ContentLength = data.Length;
                req.Timeout = 10000;

                using (var stream = req.GetRequestStream())
                    stream.Write(data, 0, data.Length);

                using (var resp = req.GetResponse())
                using (var reader = new StreamReader(resp.GetResponseStream()))
                    return reader.ReadToEnd();
            }
            catch (WebException ex)
            {
                Console.WriteLine("[http] Error: " + ex.Message);
                if (ex.Response != null)
                {
                    using (var reader = new StreamReader(ex.Response.GetResponseStream()))
                        return reader.ReadToEnd();
                }
                return "{}";
            }
            catch (Exception ex)
            {
                Console.WriteLine("[http] Error: " + ex.Message);
                return "{}";
            }
        }

        static string HttpGet(string url)
        {
            try
            {
                ServicePointManager.ServerCertificateValidationCallback = ValidateCertificate;
                WebRequest req = WebRequest.Create(url);
                req.Method = "GET";
                req.Timeout = 10000;

                using (var resp = req.GetResponse())
                using (var reader = new StreamReader(resp.GetResponseStream()))
                    return reader.ReadToEnd();
            }
            catch { return "[]"; }
        }

        static void Shutdown()
        {
            Console.WriteLine("[agent] Shutting down...");
            try
            {
                if (!string.IsNullOrEmpty(SessionId))
                {
                    var data = new Dictionary<string, object> { { "sessionId", SessionId } };
                    HttpPost(ServerUrl + "/api/remote/unregister", Json.Serialize(data));
                }
            }
            catch { }
            Console.WriteLine("[agent] Goodbye!");
            if (isServiceMode) stopEvent.Set();
            else Environment.Exit(0);
        }

        // ==================== CLIPBOARD SYNC ====================
        static void HandleClipboardSet(Dictionary<string, object> cmd)
        {
            if (!cmd.ContainsKey("text")) return;
            string text = cmd["text"].ToString();
            try
            {
                // Use PowerShell to set clipboard (works in service mode too)
                string escaped = text.Replace("'", "''");
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = string.Format("-NoProfile -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText('{0}')\"", escaped),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                Process proc = Process.Start(psi);
                proc.WaitForExit(3000);
                Console.WriteLine("[clipboard] Set " + text.Length + " chars");
            }
            catch (Exception ex)
            {
                Console.WriteLine("[clipboard] Set failed: " + ex.Message);
            }
        }

        static void HandleClipboardGet()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "-NoProfile -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetText()\"",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true
                };
                Process proc = Process.Start(psi);
                string output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit(3000);

                string clipText = output.Trim();
                if (!string.IsNullOrEmpty(clipText))
                {
                    // Send clipboard back to server
                    var data = new Dictionary<string, object>
                    {
                        { "sessionId", SessionId },
                        { "viewerId", ViewerId },
                        { "text", clipText }
                    };
                    HttpPost(ServerUrl + "/api/remote/clipboard", Json.Serialize(data));
                    Console.WriteLine("[clipboard] Sent " + clipText.Length + " chars");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[clipboard] Get failed: " + ex.Message);
            }
        }

        // ==================== FILE TRANSFER ====================
        static Dictionary<string, List<byte[]>> fileChunks = new Dictionary<string, List<byte[]>>();
        static Dictionary<string, int> fileChunkTotal = new Dictionary<string, int>();

        static void HandleFileChunk(Dictionary<string, object> cmd)
        {
            if (!cmd.ContainsKey("chunkId") || !cmd.ContainsKey("filename") || !cmd.ContainsKey("chunk")) return;

            string chunkId = cmd["chunkId"].ToString();
            string filename = cmd["filename"].ToString();
            int index = cmd.ContainsKey("index") ? Convert.ToInt32(cmd["index"]) : 0;
            int total = cmd.ContainsKey("total") ? Convert.ToInt32(cmd["total"]) : 1;

            // Store chunk
            if (!fileChunks.ContainsKey(chunkId))
                fileChunks[chunkId] = new List<byte[]>();
            fileChunkTotal[chunkId] = total;

            // Decode base64 chunk
            try
            {
                byte[] chunkData = Convert.FromBase64String(cmd["chunk"].ToString());
                while (fileChunks[chunkId].Count <= index)
                    fileChunks[chunkId].Add(null);
                fileChunks[chunkId][index] = chunkData;

                Console.WriteLine("[file] Chunk " + (index + 1) + "/" + total + " for " + filename);

                // Check if all chunks received
                bool allReceived = true;
                for (int i = 0; i < total; i++)
                {
                    if (fileChunks[chunkId][i] == null)
                    {
                        allReceived = false;
                        break;
                    }
                }

                if (allReceived)
                {
                    // Assemble file
                    using (var ms = new MemoryStream())
                    {
                        foreach (var chunk in fileChunks[chunkId])
                            ms.Write(chunk, 0, chunk.Length);

                        // Save to Downloads folder
                        string downloads = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + "\\Downloads";
                        char[] invalidChars = Path.GetInvalidFileNameChars();
                        string safeName = string.Concat(filename.Where(c => Array.IndexOf(invalidChars, c) == -1));
                        string savePath = Path.Combine(downloads, safeName);
                        File.WriteAllBytes(savePath, ms.ToArray());

                        Console.WriteLine("[file] Saved: " + savePath + " (" + ms.Length + " bytes)");

                        // Notify server
                        var data = new Dictionary<string, object>
                        {
                            { "sessionId", SessionId },
                            { "filename", filename },
                            { "size", ms.Length },
                            { "path", savePath }
                        };
                        HttpPost(ServerUrl + "/api/remote/file-saved", Json.Serialize(data));
                    }

                    // Cleanup
                    fileChunks.Remove(chunkId);
                    fileChunkTotal.Remove(chunkId);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[file] Chunk error: " + ex.Message);
            }
        }

        // ==================== WINDOWS FORMS UI ====================
        // DeviceInfoForm: small always-on-top panel showing Device ID + Password
        class DeviceInfoForm : Form
        {
            private Label lblTitle;
            private Label lblDeviceIdValue;
            private Label lblPasswordValue;
            private Label lblStatus;
            private Label lblStatusValue;
            private System.Windows.Forms.Timer statusTimer;

            public DeviceInfoForm(string deviceId, string password)
            {
                this.Text = "DevTrack Agent";
                this.Size = new Size(340, 220);
                this.FormBorderStyle = FormBorderStyle.FixedToolWindow;
                this.StartPosition = FormStartPosition.Manual;
                Rectangle screen = Screen.PrimaryScreen.WorkingArea;
                this.Location = new Point(screen.Right - 360, screen.Top + 10);
                this.TopMost = true;
                this.ShowInTaskbar = false;
                this.BackColor = Color.FromArgb(30, 30, 40);
                this.ForeColor = Color.White;

                // Title
                lblTitle = new Label();
                lblTitle.Text = "DevTrack Remote Agent v5.0";
                lblTitle.Font = new Font("Segoe UI", 10, FontStyle.Bold);
                lblTitle.ForeColor = Color.FromArgb(100, 180, 255);
                lblTitle.Location = new Point(15, 12);
                lblTitle.Size = new Size(310, 25);

                // Device ID
                Label lblDeviceId = new Label();
                lblDeviceId.Text = "Device ID:";
                lblDeviceId.Font = new Font("Segoe UI", 9);
                lblDeviceId.ForeColor = Color.LightGray;
                lblDeviceId.Location = new Point(15, 48);
                lblDeviceId.Size = new Size(90, 22);

                lblDeviceIdValue = new Label();
                lblDeviceIdValue.Text = deviceId ?? "N/A";
                lblDeviceIdValue.Font = new Font("Consolas", 14, FontStyle.Bold);
                lblDeviceIdValue.ForeColor = Color.White;
                lblDeviceIdValue.Location = new Point(15, 70);
                lblDeviceIdValue.Size = new Size(300, 30);
                lblDeviceIdValue.Cursor = Cursors.Hand;
                lblDeviceIdValue.Click += new EventHandler(CopyDeviceId);
                lblDeviceIdValue.BackColor = Color.FromArgb(45, 45, 60);
                lblDeviceIdValue.Padding = new Padding(8, 3, 8, 3);
                lblDeviceIdValue.AutoSize = true;

                // Password
                Label lblPassword = new Label();
                lblPassword.Text = "Password:";
                lblPassword.Font = new Font("Segoe UI", 9);
                lblPassword.ForeColor = Color.LightGray;
                lblPassword.Location = new Point(15, 108);
                lblPassword.Size = new Size(90, 22);

                string displayPw = string.IsNullOrEmpty(password) ? "(not set)" : password;
                lblPasswordValue = new Label();
                lblPasswordValue.Text = displayPw;
                lblPasswordValue.Font = new Font("Consolas", 11, FontStyle.Bold);
                lblPasswordValue.ForeColor = Color.FromArgb(255, 200, 80);
                lblPasswordValue.Location = new Point(15, 130);
                lblPasswordValue.Size = new Size(300, 26);
                lblPasswordValue.Cursor = Cursors.Hand;
                lblPasswordValue.Click += new EventHandler(CopyPassword);
                lblPasswordValue.BackColor = Color.FromArgb(45, 45, 60);
                lblPasswordValue.Padding = new Padding(8, 2, 8, 2);
                lblPasswordValue.AutoSize = true;

                // Status
                lblStatus = new Label();
                lblStatus.Text = "Status:";
                lblStatus.Font = new Font("Segoe UI", 9);
                lblStatus.ForeColor = Color.LightGray;
                lblStatus.Location = new Point(15, 165);
                lblStatus.Size = new Size(55, 22);

                lblStatusValue = new Label();
                lblStatusValue.Text = "Connecting...";
                lblStatusValue.Font = new Font("Segoe UI", 9, FontStyle.Bold);
                lblStatusValue.ForeColor = Color.FromArgb(255, 180, 50);
                lblStatusValue.Location = new Point(70, 165);
                lblStatusValue.Size = new Size(240, 22);

                // Copy hint
                Label lblHint = new Label();
                lblHint.Text = "Click ID/Password to copy";
                lblHint.Font = new Font("Segoe UI", 7);
                lblHint.ForeColor = Color.Gray;
                lblHint.Location = new Point(15, 190);
                lblHint.Size = new Size(300, 16);

                this.Controls.Add(lblTitle);
                this.Controls.Add(lblDeviceId);
                this.Controls.Add(lblDeviceIdValue);
                this.Controls.Add(lblPassword);
                this.Controls.Add(lblPasswordValue);
                this.Controls.Add(lblStatus);
                this.Controls.Add(lblStatusValue);
                this.Controls.Add(lblHint);

                // Status poll timer
                statusTimer = new System.Windows.Forms.Timer();
                statusTimer.Interval = 3000;
                statusTimer.Tick += new EventHandler(UpdateStatus);
                statusTimer.Start();
            }

            private void CopyDeviceId(object sender, EventArgs e)
            {
                try
                {
                    Clipboard.SetText(lblDeviceIdValue.Text);
                    lblStatusValue.Text = "Device ID copied!";
                    lblStatusValue.ForeColor = Color.FromArgb(80, 220, 120);
                }
                catch { }
            }

            private void CopyPassword(object sender, EventArgs e)
            {
                try
                {
                    Clipboard.SetText(lblPasswordValue.Text);
                    lblStatusValue.Text = "Password copied!";
                    lblStatusValue.ForeColor = Color.FromArgb(80, 220, 120);
                }
                catch { }
            }

            private void UpdateStatus(object sender, EventArgs e)
            {
                try
                {
                    if (!string.IsNullOrEmpty(SessionId))
                    {
                        lblStatusValue.Text = "Online - Ready";
                        lblStatusValue.ForeColor = Color.FromArgb(80, 220, 120);
                    }
                    else
                    {
                        lblStatusValue.Text = "Disconnected - Reconnecting...";
                        lblStatusValue.ForeColor = Color.FromArgb(255, 80, 80);
                    }
                }
                catch { }
            }

            protected override void OnFormClosing(FormClosingEventArgs e)
            {
                // Minimize to tray instead of closing
                if (e.CloseReason == CloseReason.UserClosing)
                {
                    e.Cancel = true;
                    this.Hide();
                }
                base.OnFormClosing(e);
            }
        }

        // ApprovalRequestForm: popup dialog for connection approval
        class ApprovalRequestForm : Form
        {
            public bool Approved = false;
            private Label lblMessage;
            private Button btnApprove;
            private Button btnReject;
            private System.Windows.Forms.Timer autoCloseTimer;
            private int autoCloseSeconds = 30;

            public ApprovalRequestForm(string viewerName, string message)
            {
                this.Text = "DevTrack - Connection Request";
                this.Size = new Size(420, 280);
                this.FormBorderStyle = FormBorderStyle.FixedDialog;
                this.StartPosition = FormStartPosition.CenterScreen;
                this.TopMost = true;
                this.ShowInTaskbar = false;
                this.BackColor = Color.FromArgb(30, 30, 40);
                this.ForeColor = Color.White;
                this.MaximizeBox = false;
                this.MinimizeBox = false;

                // Icon
                Label lblIcon = new Label();
                lblIcon.Text = "Remote Desktop";
                lblIcon.Font = new Font("Segoe UI", 12, FontStyle.Bold);
                lblIcon.ForeColor = Color.FromArgb(100, 180, 255);
                lblIcon.Location = new Point(15, 15);
                lblIcon.Size = new Size(380, 30);

                // Separator
                Label lblSep = new Label();
                lblSep.BorderStyle = BorderStyle.Fixed3D;
                lblSep.Location = new Point(15, 50);
                lblSep.Size = new Size(380, 2);

                // Message
                lblMessage = new Label();
                lblMessage.Text = message + "\n\nFrom: " + viewerName;
                lblMessage.Font = new Font("Segoe UI", 10);
                lblMessage.ForeColor = Color.White;
                lblMessage.Location = new Point(20, 65);
                lblMessage.Size = new Size(370, 70);

                // Auto-close info
                Label lblAutoClose = new Label();
                lblAutoClose.Text = "Auto-reject in 30 seconds";
                lblAutoClose.Font = new Font("Segoe UI", 8);
                lblAutoClose.ForeColor = Color.Gray;
                lblAutoClose.Location = new Point(20, 145);
                lblAutoClose.Size = new Size(370, 20);

                // Approve button
                btnApprove = new Button();
                btnApprove.Text = "Allow";
                btnApprove.Font = new Font("Segoe UI", 11, FontStyle.Bold);
                btnApprove.BackColor = Color.FromArgb(40, 180, 80);
                btnApprove.ForeColor = Color.White;
                btnApprove.FlatStyle = FlatStyle.Flat;
                btnApprove.Size = new Size(175, 45);
                btnApprove.Location = new Point(20, 180);
                btnApprove.Click += new EventHandler(OnApprove);

                // Reject button
                btnReject = new Button();
                btnReject.Text = "Deny";
                btnReject.Font = new Font("Segoe UI", 11, FontStyle.Bold);
                btnReject.BackColor = Color.FromArgb(200, 50, 50);
                btnReject.ForeColor = Color.White;
                btnReject.FlatStyle = FlatStyle.Flat;
                btnReject.Size = new Size(175, 45);
                btnReject.Location = new Point(215, 180);
                btnReject.Click += new EventHandler(OnReject);

                this.Controls.Add(lblIcon);
                this.Controls.Add(lblSep);
                this.Controls.Add(lblMessage);
                this.Controls.Add(lblAutoClose);
                this.Controls.Add(btnApprove);
                this.Controls.Add(btnReject);

                // Auto-reject timer
                autoCloseTimer = new System.Windows.Forms.Timer();
                autoCloseTimer.Interval = 1000;
                autoCloseTimer.Tick += new EventHandler(AutoCloseTick);
                autoCloseTimer.Start();
            }

            private void AutoCloseTick(object sender, EventArgs e)
            {
                autoCloseSeconds--;
                lblMessage.Text = "Remote connection requested\n\nAuto-reject in " + autoCloseSeconds + " seconds";
                if (autoCloseSeconds <= 0)
                {
                    autoCloseTimer.Stop();
                    this.DialogResult = DialogResult.Cancel;
                    this.Close();
                }
            }

            private void OnApprove(object sender, EventArgs e)
            {
                Approved = true;
                autoCloseTimer.Stop();
                this.DialogResult = DialogResult.OK;
                this.Close();
            }

            private void OnReject(object sender, EventArgs e)
            {
                Approved = false;
                autoCloseTimer.Stop();
                this.DialogResult = DialogResult.Cancel;
                this.Close();
            }
        }

        // ==================== WINDOWS SERVICE ====================
        class DevTrackService : ServiceBase
        {
            private Thread serviceThread;
            private ManualResetEvent serviceStopEvent = new ManualResetEvent(false);

            public DevTrackService()
            {
                ServiceName = "DevTrackAgent";
                CanStop = true;
                CanPauseAndContinue = false;
                AutoLog = true;
            }

            protected override void OnStart(string[] args)
            {
                EventLog.WriteEntry("DevTrack Agent starting...");
                serviceThread = new Thread(RunServiceLoop);
                serviceThread.IsBackground = true;
                serviceThread.Start();
            }

            protected override void OnStop()
            {
                EventLog.WriteEntry("DevTrack Agent stopping...");
                Running = false;
                serviceStopEvent.Set();
                // Give threads time to finish
                if (serviceThread != null && serviceThread.IsAlive)
                    serviceThread.Join(5000);
                Shutdown();
            }

            private void RunServiceLoop()
            {
                try
                {
                    Json = new JavaScriptSerializer();
                    Json.MaxJsonLength = int.MaxValue;

                    // Enable TLS 1.2
                    try
                    {
                        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                    }
                    catch { }
                    ServicePointManager.DefaultConnectionLimit = 10;

                    // Load config
                    LoadConfig();
                    Console.WriteLine("[service] Config loaded. Device ID: " + DeviceId);
                    Console.WriteLine("[service] Server: " + ServerUrl);

                    // Get local IP and screen info
                    string localIP = GetLocalIP();
                    int screenW = GetSystemMetrics(0);
                    int screenH = GetSystemMetrics(1);
                    if (screenW <= 0) screenW = 1920;
                    if (screenH <= 0) screenH = 1080;

                    // Keep session alive after RDP disconnect
                    if (KeepAlive)
                        KeepSessionAlive();

                    // Register with server
                    Console.WriteLine("[service] Registering with server...");
                    try
                    {
                        var regData = new Dictionary<string, object>
                        {
                            { "name", DeviceName }, { "os", "win32" },
                            { "osVersion", Environment.OSVersion.ToString() },
                            { "ip", localIP }, { "hostname", Environment.MachineName },
                            { "deviceId", DeviceId },
                            { "resolution", new Dictionary<string, int> { { "width", screenW }, { "height", screenH } } },
                            { "agentVersion", "6.0.0" }, { "password", DevicePassword }, { "devicePassword", DevicePassword }
                        };
                        if (!string.IsNullOrEmpty(DeviceApiKey))
                            regData["apiKey"] = DeviceApiKey;

                        string response = HttpPost(ServerUrl + "/api/remote/register", Json.Serialize(regData));
                        Console.WriteLine("[service] Register response: " + response.Substring(0, Math.Min(response.Length, 200)));
                        var result = Json.Deserialize<Dictionary<string, object>>(response);
                        if (result.ContainsKey("sessionId"))
                        {
                            SessionId = result["sessionId"].ToString();
                            if (result.ContainsKey("apiKey"))
                                SessionApiKey = result["apiKey"].ToString();
                            Console.WriteLine("[service] Registered! Session: " + SessionId);
                        }
                        else if (result.ContainsKey("error"))
                        {
                            Console.WriteLine("[service] Registration rejected: " + result["error"].ToString());
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("[service] Registration failed: " + ex.Message);
                    }

                    // Start background threads
                    Thread heartbeatThread = new Thread(() => { while (Running) { SendHeartbeat(); Thread.Sleep(5000); } });
                    heartbeatThread.IsBackground = true;
                    heartbeatThread.Start();

                    Thread captureThread = new Thread(() => { while (Running) { CaptureAndSend(); Thread.Sleep(1000 / MaxFPS); } });
                    captureThread.IsBackground = true;
                    captureThread.Start();

                    Thread commandThread = new Thread(() => { while (Running) { PollCommands(); Thread.Sleep(200); } });
                    commandThread.IsBackground = true;
                    commandThread.Start();

                    Console.WriteLine("[service] Agent running. Waiting for connections...");
                    EventLog.WriteEntry("DevTrack Agent started successfully. Device ID: " + DeviceId);

                    // Keep service alive until stopped
                    while (Running)
                    {
                        serviceStopEvent.WaitOne(1000);
                    }
                }
                catch (Exception ex)
                {
                    EventLog.WriteEntry("DevTrack Agent error: " + ex.Message, EventLogEntryType.Error);
                }
            }
        }

        // ==================== SERVICE INSTALL/UNINSTALL ====================
        static void InstallService()
        {
            try
            {
                string exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
                Console.WriteLine("[install] Installing DevTrackAgent service...");
                Console.WriteLine("[install] Path: " + exePath);

                // Use sc.exe to create the service
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "sc.exe",
                    Arguments = string.Format("create DevTrackAgent binPath= \"{0} --service\" start= auto DisplayName= \"DevTrack Remote Agent\"", exePath),
                    Verb = "runas",
                    UseShellExecute = true
                };
                Process proc = Process.Start(psi);
                proc.WaitForExit();

                if (proc.ExitCode == 0)
                {
                    Console.WriteLine("[install] Service installed successfully!");
                    Console.WriteLine("[install] Starting service...");

                    // Start the service
                    ProcessStartInfo startPsi = new ProcessStartInfo
                    {
                        FileName = "sc.exe",
                        Arguments = "start DevTrackAgent",
                        Verb = "runas",
                        UseShellExecute = true
                    };
                    Process startProc = Process.Start(startPsi);
                    startProc.WaitForExit();

                    if (startProc.ExitCode == 0)
                        Console.WriteLine("[install] Service started!");
                    else
                        Console.WriteLine("[install] Warning: Could not start service (exit code: " + startProc.ExitCode + ")");
                }
                else
                {
                    Console.WriteLine("[install] Failed to install service (exit code: " + proc.ExitCode + ")");
                    Console.WriteLine("[install] Make sure to run as Administrator!");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[install] Error: " + ex.Message);
                Console.WriteLine("[install] Make sure to run as Administrator!");
            }
        }

        static void UninstallService()
        {
            try
            {
                Console.WriteLine("[uninstall] Stopping DevTrackAgent service...");
                ProcessStartInfo stopPsi = new ProcessStartInfo
                {
                    FileName = "sc.exe",
                    Arguments = "stop DevTrackAgent",
                    Verb = "runas",
                    UseShellExecute = true
                };
                Process stopProc = Process.Start(stopPsi);
                stopProc.WaitForExit();
                Thread.Sleep(2000);

                Console.WriteLine("[uninstall] Removing DevTrackAgent service...");
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "sc.exe",
                    Arguments = "delete DevTrackAgent",
                    Verb = "runas",
                    UseShellExecute = true
                };
                Process proc = Process.Start(psi);
                proc.WaitForExit();

                if (proc.ExitCode == 0)
                    Console.WriteLine("[uninstall] Service removed successfully!");
                else
                    Console.WriteLine("[uninstall] Failed to remove service (exit code: " + proc.ExitCode + ")");
            }
            catch (Exception ex)
            {
                Console.WriteLine("[uninstall] Error: " + ex.Message);
                Console.WriteLine("[uninstall] Make sure to run as Administrator!");
            }
        }
    }
}
