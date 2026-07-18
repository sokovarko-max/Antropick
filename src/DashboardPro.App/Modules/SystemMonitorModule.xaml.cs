using DashboardPro.App.Services;
using DashboardPro.Core.Models;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

public sealed partial class SystemMonitorModule : UserControl
{
    private readonly SystemMonitorService _monitor = new();
    private readonly DispatcherQueueTimer _timer;

    public SystemMonitorModule(ModuleConfig config)
    {
        InitializeComponent();
        _timer = DispatcherQueue.CreateTimer();
        _timer.Interval = TimeSpan.FromSeconds(2);
        _timer.Tick += (_, _) => Render();
        Loaded += (_, _) => { _monitor.Sample(); _timer.Start(); };
        Unloaded += (_, _) => _timer.Stop();
    }

    private void Render()
    {
        var s = _monitor.Sample();
        CpuBar.Value = s.CpuPercent;
        CpuText.Text = $"{s.CpuPercent:0}%";
        RamBar.Value = s.RamPercent;
        RamText.Text = $"{s.RamPercent:0}%";
        DetailsText.Text = $"Память: {s.RamUsedGb:0.0} из {s.RamTotalGb:0.0} ГБ";
        NetText.Text = $"Сеть: ↓ {SystemMonitorService.FormatSpeed(s.DownloadBytesPerSec)}  ↑ {SystemMonitorService.FormatSpeed(s.UploadBytesPerSec)}";
    }
}
