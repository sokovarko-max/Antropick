using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

/// <summary>События календаря на сегодня.</summary>
public sealed partial class TodayModule : UserControl
{
    public TodayModule(ModuleConfig config)
    {
        InitializeComponent();
        Loaded += (_, _) => { App.Hub.Updated += OnHubUpdated; Render(); };
        Unloaded += (_, _) => App.Hub.Updated -= OnHubUpdated;
    }

    private void OnHubUpdated() => DispatcherQueue.TryEnqueue(Render);

    private void Render()
    {
        ListPanel.Children.Clear();

        if (App.Hub.EventsError is { } error)
        {
            ListPanel.Children.Add(UiFactory.Secondary($"Календарь: {error}"));
            return;
        }
        if (App.Hub.CalendarSource is null)
        {
            ListPanel.Children.Add(UiFactory.Secondary("Календарь не подключён — добавьте ICS-ссылку в настройках."));
            return;
        }

        var today = App.Hub.Events
            .Where(e => e.Start.Date == DateTime.Today || (e.Start.Date < DateTime.Today && e.End > DateTime.Today))
            .OrderBy(e => e.IsAllDay ? 0 : 1)
            .ThenBy(e => e.Start)
            .ToList();

        if (today.Count == 0)
        {
            ListPanel.Children.Add(UiFactory.Secondary("Сегодня событий нет."));
            return;
        }

        foreach (var ev in today)
        {
            var row = new Grid { ColumnSpacing = 8 };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(72) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            var time = UiFactory.Secondary(ev.TimeRange);
            if (!ev.IsAllDay && ev.End < DateTime.Now) time.Opacity = 0.5;
            row.Children.Add(time);

            var right = new StackPanel();
            var title = UiFactory.Text(ev.Title);
            if (!ev.IsAllDay && ev.End < DateTime.Now) title.Opacity = 0.5;
            right.Children.Add(title);
            if (!string.IsNullOrWhiteSpace(ev.Location))
                right.Children.Add(UiFactory.Secondary(ev.Location, 11));
            Grid.SetColumn(right, 1);
            row.Children.Add(right);

            ListPanel.Children.Add(row);
        }
    }
}
