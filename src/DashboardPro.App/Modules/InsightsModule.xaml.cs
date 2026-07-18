using DashboardPro.Core.Models;
using DashboardPro.Core.Services;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

/// <summary>
/// Интеллектуальный модуль: периодически анализирует задачи и календарь и подсказывает,
/// чем лучше заняться. Провайдер подсказок заменяем (см. IInsightProvider в ядре).
/// </summary>
public sealed partial class InsightsModule : UserControl, IModuleControl
{
    private readonly ModuleConfig _config;
    private readonly IInsightProvider _provider = new RuleBasedInsightProvider();
    private readonly DispatcherQueueTimer _timer;

    public InsightsModule(ModuleConfig config)
    {
        _config = config;
        InitializeComponent();
        _timer = DispatcherQueue.CreateTimer();
        _timer.Tick += (_, _) => _ = RenderAsync();
        Loaded += (_, _) => { App.Hub.Updated += OnHubUpdated; Restart(); };
        Unloaded += (_, _) => { App.Hub.Updated -= OnHubUpdated; _timer.Stop(); };
    }

    public void OnSettingsChanged() => Restart();

    private void Restart()
    {
        _timer.Stop();
        _timer.Interval = TimeSpan.FromMinutes(Math.Max(1, ModuleItem.GetInt(_config, "refreshMinutes", 10)));
        _timer.Start();
        _ = RenderAsync();
    }

    private void OnHubUpdated() => DispatcherQueue.TryEnqueue(() => _ = RenderAsync());

    private async Task RenderAsync()
    {
        var insights = await _provider.GetInsightsAsync(App.Hub.Tasks, App.Hub.Events, DateTime.Now);

        ListPanel.Children.Clear();
        foreach (var insight in insights)
        {
            var row = new Grid { ColumnSpacing = 8 };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            var icon = UiFactory.Icon(insight.Glyph, 13);
            icon.VerticalAlignment = VerticalAlignment.Top;
            icon.Margin = new Thickness(0, 2, 0, 0);
            if (insight.Severity == InsightSeverity.Warning) icon.Foreground = UiFactory.ErrorBrush();
            if (insight.Severity == InsightSeverity.Suggestion) icon.Foreground = UiFactory.AccentBrush();
            row.Children.Add(icon);

            var text = UiFactory.Text(insight.Text);
            Grid.SetColumn(text, 1);
            row.Children.Add(text);

            ListPanel.Children.Add(row);
        }
    }
}
