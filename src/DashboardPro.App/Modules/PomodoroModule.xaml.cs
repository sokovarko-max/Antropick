using DashboardPro.Core.Models;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Windows.AppNotifications;
using Microsoft.Windows.AppNotifications.Builder;

namespace DashboardPro.App.Modules;

public sealed partial class PomodoroModule : UserControl, IModuleControl
{
    private readonly ModuleConfig _config;
    private readonly DispatcherQueueTimer _timer;

    private PomodoroKind _phase = PomodoroKind.Work;
    private TimeSpan _remaining;
    private bool _running;
    private int _completedWorkCount;

    public PomodoroModule(ModuleConfig config)
    {
        _config = config;
        InitializeComponent();
        _timer = DispatcherQueue.CreateTimer();
        _timer.Interval = TimeSpan.FromSeconds(1);
        _timer.Tick += (_, _) => OnTick();
        ResetPhase(PomodoroKind.Work);
        Loaded += (_, _) => Render();
        Unloaded += (_, _) => _timer.Stop();
    }

    private int Minutes(PomodoroKind kind) => kind switch
    {
        PomodoroKind.Work => Math.Max(1, ModuleItem.GetInt(_config, "work", 25)),
        PomodoroKind.ShortBreak => Math.Max(1, ModuleItem.GetInt(_config, "shortBreak", 5)),
        _ => Math.Max(1, ModuleItem.GetInt(_config, "longBreak", 15))
    };

    private int CyclesBeforeLongBreak => Math.Max(1, ModuleItem.GetInt(_config, "cycles", 4));
    private bool AutoStart => ModuleItem.GetBool(_config, "autoStart", true);

    public void OnSettingsChanged()
    {
        if (!_running) ResetPhase(_phase);
        Render();
    }

    private void ResetPhase(PomodoroKind phase)
    {
        _phase = phase;
        _remaining = TimeSpan.FromMinutes(Minutes(phase));
    }

    private void OnTick()
    {
        _remaining -= TimeSpan.FromSeconds(1);
        if (_remaining <= TimeSpan.Zero) CompletePhase();
        Render();
    }

    private void CompletePhase()
    {
        App.Store.AddPomodoroSession(_phase, Minutes(_phase));
        var finished = _phase;

        if (_phase == PomodoroKind.Work)
        {
            _completedWorkCount++;
            ResetPhase(_completedWorkCount % CyclesBeforeLongBreak == 0
                ? PomodoroKind.LongBreak
                : PomodoroKind.ShortBreak);
        }
        else
        {
            ResetPhase(PomodoroKind.Work);
        }

        _running = AutoStart;
        if (!_running) _timer.Stop();

        Notify(finished);
    }

    private void Notify(PomodoroKind finished)
    {
        try
        {
            var text = finished == PomodoroKind.Work
                ? $"Помидор завершён! {PhaseName(_phase)} — {Minutes(_phase)} мин."
                : $"Перерыв окончен. {PhaseName(_phase)} — {Minutes(_phase)} мин.";
            AppNotificationManager.Default.Show(
                new AppNotificationBuilder().AddText("Pomodoro").AddText(text).BuildNotification());
        }
        catch
        {
            // Уведомления могут быть недоступны — таймер продолжает работать
        }
    }

    private static string PhaseName(PomodoroKind kind) => kind switch
    {
        PomodoroKind.Work => "Фокус",
        PomodoroKind.ShortBreak => "Короткий перерыв",
        _ => "Длинный перерыв"
    };

    private void Render()
    {
        PhaseText.Text = $"{PhaseName(_phase)} • цикл {_completedWorkCount % CyclesBeforeLongBreak + 1} из {CyclesBeforeLongBreak}";
        TimeText.Text = $"{(int)_remaining.TotalMinutes:00}:{_remaining.Seconds:00}";
        var total = TimeSpan.FromMinutes(Minutes(_phase));
        Progress.Value = 1 - _remaining.TotalSeconds / total.TotalSeconds;
        StartPauseButton.Content = _running ? "Пауза" : "Старт";
        StatsText.Text = $"Сегодня завершено помидоров: {App.Store.CountPomodorosToday()}";
    }

    private void OnStartPauseClick(object sender, RoutedEventArgs e)
    {
        _running = !_running;
        if (_running) _timer.Start(); else _timer.Stop();
        Render();
    }

    private void OnSkipClick(object sender, RoutedEventArgs e)
    {
        CompletePhase();
        Render();
    }

    private void OnResetClick(object sender, RoutedEventArgs e)
    {
        _running = false;
        _timer.Stop();
        _completedWorkCount = 0;
        ResetPhase(PomodoroKind.Work);
        Render();
    }
}
