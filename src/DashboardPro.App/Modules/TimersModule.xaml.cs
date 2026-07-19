using System.Diagnostics;
using DashboardPro.Core.Models;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Windows.AppNotifications;
using Microsoft.Windows.AppNotifications.Builder;

namespace DashboardPro.App.Modules;

/// <summary>Секундомер и таймер обратного отсчёта с уведомлением.</summary>
public sealed partial class TimersModule : UserControl
{
    private readonly DispatcherQueueTimer _timer;
    private readonly Stopwatch _stopwatch = new();

    private DateTime? _countdownEnd;

    public TimersModule(ModuleConfig config)
    {
        InitializeComponent();
        _timer = DispatcherQueue.CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(100);
        _timer.Tick += (_, _) => Render();
        Loaded += (_, _) => _timer.Start();
        Unloaded += (_, _) => _timer.Stop();
    }

    private void Render()
    {
        var e = _stopwatch.Elapsed;
        StopwatchText.Text = e.TotalHours >= 1
            ? $"{(int)e.TotalHours}:{e.Minutes:00}:{e.Seconds:00}"
            : $"{e.Minutes:00}:{e.Seconds:00}.{e.Milliseconds / 100}";

        if (_countdownEnd is { } end)
        {
            var left = end - DateTime.Now;
            if (left <= TimeSpan.Zero)
            {
                _countdownEnd = null;
                CountdownText.Text = "00:00";
                CountdownButton.Content = "Старт";
                try
                {
                    AppNotificationManager.Default.Show(new AppNotificationBuilder()
                        .AddText("Таймер").AddText("Время вышло!").BuildNotification());
                }
                catch { }
            }
            else
            {
                CountdownText.Text = left.TotalHours >= 1
                    ? $"{(int)left.TotalHours}:{left.Minutes:00}:{left.Seconds:00}"
                    : $"{left.Minutes:00}:{left.Seconds:00}";
            }
        }
    }

    private void OnStopwatchClick(object sender, RoutedEventArgs e)
    {
        if (_stopwatch.IsRunning) { _stopwatch.Stop(); StopwatchButton.Content = "Старт"; }
        else { _stopwatch.Start(); StopwatchButton.Content = "Пауза"; }
    }

    private void OnStopwatchResetClick(object sender, RoutedEventArgs e)
    {
        _stopwatch.Reset();
        StopwatchButton.Content = "Старт";
        Render();
    }

    private void OnCountdownClick(object sender, RoutedEventArgs e)
    {
        if (_countdownEnd is null)
        {
            _countdownEnd = DateTime.Now.AddMinutes(Math.Max(1, MinutesBox.Value));
            CountdownButton.Content = "Стоп";
        }
        else
        {
            _countdownEnd = null;
            CountdownText.Text = "";
            CountdownButton.Content = "Старт";
        }
    }
}
