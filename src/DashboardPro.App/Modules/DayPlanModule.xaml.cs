using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

/// <summary>Хронологический план дня: события календаря + задачи с дедлайном на сегодня.</summary>
public sealed partial class DayPlanModule : UserControl
{
    public DayPlanModule(ModuleConfig config)
    {
        InitializeComponent();
        Loaded += (_, _) => { App.Hub.Updated += OnHubUpdated; Render(); };
        Unloaded += (_, _) => App.Hub.Updated -= OnHubUpdated;
    }

    private void OnHubUpdated() => DispatcherQueue.TryEnqueue(Render);

    private sealed record Row(DateTime Sort, string Time, string Glyph, string Title, bool Past);

    private void Render()
    {
        ListPanel.Children.Clear();
        var rows = new List<Row>();

        foreach (var ev in App.Hub.Events.Where(e => e.Start.Date == DateTime.Today && !e.IsAllDay))
            rows.Add(new Row(ev.Start, ev.TimeRange, "\uE787", ev.Title, ev.End < DateTime.Now));

        foreach (var task in App.Hub.Tasks.Where(t => !t.IsCompleted && t.IsDueToday))
        {
            var hasTime = task.DueDate!.Value.TimeOfDay > TimeSpan.Zero;
            rows.Add(new Row(
                hasTime ? task.DueDate.Value : DateTime.Today.AddHours(23),
                hasTime ? task.DueDate.Value.ToString("HH:mm") : "сегодня",
                "\uE73E", task.Title, false));
        }

        if (rows.Count == 0)
        {
            ListPanel.Children.Add(UiFactory.Secondary("На сегодня план пуст."));
            return;
        }

        foreach (var r in rows.OrderBy(r => r.Sort))
        {
            var row = new Grid { ColumnSpacing = 8 };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(84) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            var time = UiFactory.Secondary(r.Time);
            row.Children.Add(time);

            var icon = UiFactory.Icon(r.Glyph, 11);
            icon.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(icon, 1);
            row.Children.Add(icon);

            var title = UiFactory.Text(r.Title);
            Grid.SetColumn(title, 2);
            row.Children.Add(title);

            if (r.Past) row.Opacity = 0.5;
            ListPanel.Children.Add(row);
        }
    }
}
