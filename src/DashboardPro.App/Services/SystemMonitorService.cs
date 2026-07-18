using System.Net.NetworkInformation;
using System.Runtime.InteropServices;

namespace DashboardPro.App.Services;

public sealed record SystemStats(double CpuPercent, double RamPercent, double RamUsedGb, double RamTotalGb,
    double DownloadBytesPerSec, double UploadBytesPerSec);

/// <summary>CPU/RAM/сеть без внешних зависимостей: GetSystemTimes + GlobalMemoryStatusEx + счётчики сетевых интерфейсов.</summary>
public sealed class SystemMonitorService
{
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemTimes(out long idle, out long kernel, out long user);

    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX buffer);

    private long _prevIdle, _prevKernel, _prevUser;
    private long _prevRx, _prevTx;
    private DateTime _prevNetTime = DateTime.MinValue;

    public SystemStats Sample()
    {
        // CPU
        double cpu = 0;
        if (GetSystemTimes(out var idle, out var kernel, out var user))
        {
            var idleDelta = idle - _prevIdle;
            var totalDelta = (kernel - _prevKernel) + (user - _prevUser); // kernel включает idle
            if (_prevIdle != 0 && totalDelta > 0)
                cpu = Math.Clamp(100.0 * (totalDelta - idleDelta) / totalDelta, 0, 100);
            (_prevIdle, _prevKernel, _prevUser) = (idle, kernel, user);
        }

        // RAM
        var mem = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
        double ramPct = 0, usedGb = 0, totalGb = 0;
        if (GlobalMemoryStatusEx(ref mem))
        {
            ramPct = mem.dwMemoryLoad;
            totalGb = mem.ullTotalPhys / 1024.0 / 1024 / 1024;
            usedGb = (mem.ullTotalPhys - mem.ullAvailPhys) / 1024.0 / 1024 / 1024;
        }

        // Сеть
        long rx = 0, tx = 0;
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up ||
                nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            var stats = nic.GetIPStatistics();
            rx += stats.BytesReceived;
            tx += stats.BytesSent;
        }
        double down = 0, up = 0;
        var now = DateTime.UtcNow;
        if (_prevNetTime != DateTime.MinValue)
        {
            var sec = (now - _prevNetTime).TotalSeconds;
            if (sec > 0)
            {
                down = Math.Max(0, (rx - _prevRx) / sec);
                up = Math.Max(0, (tx - _prevTx) / sec);
            }
        }
        (_prevRx, _prevTx, _prevNetTime) = (rx, tx, now);

        return new SystemStats(cpu, ramPct, usedGb, totalGb, down, up);
    }

    public static string FormatSpeed(double bytesPerSec) => bytesPerSec switch
    {
        >= 1 << 20 => $"{bytesPerSec / (1 << 20):0.0} МБ/с",
        >= 1 << 10 => $"{bytesPerSec / (1 << 10):0.0} КБ/с",
        _ => $"{bytesPerSec:0} Б/с"
    };
}
