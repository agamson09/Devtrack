using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace DevTrack.Capture
{
    class Program
    {
        [DllImport("user32.dll")]
        static extern IntPtr GetDC(IntPtr hwnd);

        [DllImport("user32.dll")]
        static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);

        [DllImport("gdi32.dll")]
        static extern IntPtr CreateCompatibleDC(IntPtr dc);

        [DllImport("gdi32.dll")]
        static extern IntPtr CreateCompatibleBitmap(IntPtr dc, int width, int height);

        [DllImport("gdi32.dll")]
        static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);

        [DllImport("gdi32.dll")]
        static extern bool BitBlt(IntPtr dst, int x, int y, int cx, int cy, IntPtr src, int x1, int y1, uint rop);

        [DllImport("gdi32.dll")]
        static extern bool DeleteDC(IntPtr dc);

        [DllImport("gdi32.dll")]
        static extern bool DeleteObject(IntPtr obj);

        [DllImport("user32.dll")]
        static extern int GetSystemMetrics(int nIndex);

        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint nFlags);

        const uint SRCCOPY = 0x00CC0020;
        const uint PW_RENDERFULLCONTENT = 0x00000002;

        static void Main(string[] args)
        {
            try
            {
                SetProcessDPIAware();
                Thread.Sleep(100); // Wait for DPI awareness

                int quality = 60;
                string outputFile = null;

                // Parse args: capture.exe [outputPath] [quality]
                if (args.Length > 0) outputFile = args[0];
                if (args.Length > 1) int.TryParse(args[1], out quality);

                if (string.IsNullOrEmpty(outputFile))
                    outputFile = Path.Combine(Path.GetTempPath(), "dt-ss.jpg");

                if (quality <= 0) quality = 60;
                if (quality > 100) quality = 100;

                int w = GetSystemMetrics(0);  // SM_CXSCREEN
                int h = GetSystemMetrics(1);  // SM_CYSCREEN
                if (w <= 0) w = 1920;
                if (h <= 0) h = 1080;

                Bitmap bitmap = null;
                bool captured = false;

                // Method 1: PrintWindow (captures DWM composition, works with virtual displays)
                try
                {
                    IntPtr hwnd = GetForegroundWindow();
                    IntPtr hdcScreen = GetDC(IntPtr.Zero);
                    IntPtr memDC = CreateCompatibleDC(hdcScreen);
                    IntPtr hBmp = CreateCompatibleBitmap(hdcScreen, w, h);
                    IntPtr oldObj = SelectObject(memDC, hBmp);

                    bool ok = PrintWindow(hwnd, memDC, PW_RENDERFULLCONTENT);
                    if (!ok)
                    {
                        // Fallback to BitBlt
                        ok = BitBlt(memDC, 0, 0, w, h, hdcScreen, 0, 0, SRCCOPY);
                    }

                    if (ok)
                    {
                        bitmap = Image.FromHbitmap(hBmp);
                        captured = true;
                    }

                    SelectObject(memDC, oldObj);
                    DeleteObject(hBmp);
                    DeleteDC(memDC);
                    ReleaseDC(IntPtr.Zero, hdcScreen);
                }
                catch { }

                // Method 2: CopyFromScreen (simpler, works on most systems)
                if (!captured || bitmap == null)
                {
                    try
                    {
                        bitmap = new Bitmap(w, h);
                        Graphics g = Graphics.FromImage(bitmap);
                        g.CopyFromScreen(0, 0, 0, 0, new Size(w, h));
                        g.Dispose();
                        captured = true;
                    }
                    catch { }
                }

                if (bitmap == null)
                {
                    Console.Error.WriteLine("Failed to capture screen");
                    Environment.Exit(1);
                    return;
                }

                // Save as JPEG with specified quality
                ImageCodecInfo jpegCodec = null;
                foreach (ImageCodecInfo codec in ImageCodecInfo.GetImageEncoders())
                {
                    if (codec.MimeType == "image/jpeg")
                    {
                        jpegCodec = codec;
                        break;
                    }
                }

                if (jpegCodec != null)
                {
                    EncoderParameters encoderParams = new EncoderParameters(1);
                    encoderParams.Param[0] = new EncoderParameter(Encoder.Quality, (long)quality);
                    bitmap.Save(outputFile, jpegCodec, encoderParams);
                }
                else
                {
                    bitmap.Save(outputFile, ImageFormat.Jpeg);
                }

                bitmap.Dispose();

                // Output the file path
                Console.WriteLine(outputFile);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error: " + ex.Message);
                Environment.Exit(1);
            }
        }
    }
}
