using DashboardPro.Core.Models;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

public sealed partial class ClockModule : UserControl
{
    private readonly DispatcherQueueTimer _timer;

    public ClockModule(ModuleConfig config)
    {
        InitializeComponent();
        _timer = DispatcherQueue.CreateTimer();
        _timer.Interval = TimeSpan.FromSeconds(1);
        _timer.Tick += (_, _) => Render();
        Loaded += (_, _) => { Render(); _timer.Start(); };
        Unloaded += (_, _) => _timer.Stop();
    }

    private void Render()
    {
        var now = DateTime.Now;
        TimeText.Text = now.ToString("HH:mm");
        var date = now.ToString("dddd, d MMMM");
        DateText.Text = char.ToUpper(date[0]) + date[1..];
    }
}
