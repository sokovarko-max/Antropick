using System.Runtime.InteropServices;
using Microsoft.UI.Windowing;
using Windows.Graphics;

namespace DashboardPro.App.Interop;

public static class WindowInterop
{
    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hwnd);

    public static double GetScale(IntPtr hwnd) => GetDpiForWindow(hwnd) / 96.0;

    /// <summary>Монитор для панели: по индексу из настроек либо тот, где сейчас окно (-1).</summary>
    public static DisplayArea GetDisplayArea(AppWindow appWindow, int monitorIndex)
    {
        var areas = DisplayArea.FindAll();
        if (monitorIndex >= 0 && monitorIndex < areas.Count) return areas[monitorIndex];
        return DisplayArea.GetFromWindowId(appWindow.Id, DisplayAreaFallback.Nearest);
    }

    /// <summary>Прижимает окно к левому или правому краю рабочей области монитора на всю высоту.</summary>
    public static void Dock(AppWindow appWindow, IntPtr hwnd, int widthDip, bool leftEdge, DisplayArea area)
    {
        var widthPx = (int)Math.Round(widthDip * GetScale(hwnd));
        var wa = area.WorkArea;
        var x = leftEdge ? wa.X : wa.X + wa.Width - widthPx;
        appWindow.MoveAndResize(new RectInt32(x, wa.Y, widthPx, wa.Height));
    }
}

/// <summary>
/// Регистрация окна как Shell AppBar: система резервирует полосу у края экрана,
/// и развёрнутые окна не перекрываются панелью (как у панели задач).
/// </summary>
public sealed class AppBarHelper
{
    private const int ABM_NEW = 0x0;
    private const int ABM_REMOVE = 0x1;
    private const int ABM_QUERYPOS = 0x2;
    private const int ABM_SETPOS = 0x3;
    private const int ABE_LEFT = 0;
    private const int ABE_RIGHT = 2;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct APPBARDATA
    {
        public uint cbSize;
        public IntPtr hWnd;
        public uint uCallbackMessage;
        public uint uEdge;
        public RECT rc;
        public IntPtr lParam;
    }

    [DllImport("shell32.dll")]
    private static extern UIntPtr SHAppBarMessage(int dwMessage, ref APPBARDATA pData);

    private IntPtr _hwnd;
    public bool IsRegistered { get; private set; }

    /// <summary>Резервирует полосу у края и возвращает прямоугольник (px), в который нужно поставить окно.</summary>
    public (int X, int Y, int Width, int Height) Register(IntPtr hwnd, int widthPx, RectInt32 monitorBounds, bool leftEdge)
    {
        _hwnd = hwnd;
        var data = new APPBARDATA
        {
            cbSize = (uint)Marshal.SizeOf<APPBARDATA>(),
            hWnd = hwnd,
            uEdge = leftEdge ? (uint)ABE_LEFT : ABE_RIGHT
        };

        if (!IsRegistered)
        {
            SHAppBarMessage(ABM_NEW, ref data);
            IsRegistered = true;
        }

        data.rc = leftEdge
            ? new RECT
            {
                Left = monitorBounds.X,
                Top = monitorBounds.Y,
                Right = monitorBounds.X + widthPx,
                Bottom = monitorBounds.Y + monitorBounds.Height
            }
            : new RECT
            {
                Left = monitorBounds.X + monitorBounds.Width - widthPx,
                Top = monitorBounds.Y,
                Right = monitorBounds.X + monitorBounds.Width,
                Bottom = monitorBounds.Y + monitorBounds.Height
            };

        SHAppBarMessage(ABM_QUERYPOS, ref data);
        if (leftEdge) data.rc.Right = data.rc.Left + widthPx;
        else data.rc.Left = data.rc.Right - widthPx;
        SHAppBarMessage(ABM_SETPOS, ref data);

        return (data.rc.Left, data.rc.Top, data.rc.Right - data.rc.Left, data.rc.Bottom - data.rc.Top);
    }

    public void Unregister()
    {
        if (!IsRegistered) return;
        var data = new APPBARDATA
        {
            cbSize = (uint)Marshal.SizeOf<APPBARDATA>(),
            hWnd = _hwnd
        };
        SHAppBarMessage(ABM_REMOVE, ref data);
        IsRegistered = false;
    }
}
