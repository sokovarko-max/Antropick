using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;

namespace DashboardPro.App.Modules;

/// <summary>Главные задачи: просроченные, важные и с ближайшими дедлайнами.</summary>
public sealed partial class TopTasksModule : UserControl, IModuleControl
{
    private readonly ModuleConfig _config;

    public TopTasksModule(ModuleConfig config)
    {
        _config = config;
        InitializeComponent();
        Loaded += (_, _) => { App.Hub.Updated += OnHubUpdated; Render(); };
        Unloaded += (_, _) => App.Hub.Updated -= OnHubUpdated;
    }

    public void OnSettingsChanged() => Render();

    private void OnHubUpdated() => DispatcherQueue.TryEnqueue(Render);

    private void Render()
    {
        ListPanel.Children.Clear();
        NewTaskBox.Visibility = App.Hub.TaskSource is { CanAdd: true } ? Visibility.Visible : Visibility.Collapsed;

        if (App.Hub.TasksError is { } error)
        {
            ListPanel.Children.Add(UiFactory.Secondary($"Задачи: {error}"));
            return;
        }

        var max = Math.Max(1, ModuleItem.GetInt(_config, "maxItems", 5));
        var active = App.Hub.Tasks.Where(t => !t.IsCompleted).ToList();

        var top = active
            .Where(t => t.IsOverdue || t.IsImportant || t.IsDueToday)
            .OrderByDescending(t => t.IsOverdue)
            .ThenByDescending(t => t.Priority)
            .ThenBy(t => t.DueDate ?? DateTime.MaxValue)
            .Take(max)
            .ToList();

        // Если правил не хватило — показываем ближайшие по дедлайну
        if (top.Count < max)
            top.AddRange(active.Except(top)
                .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
                .Take(max - top.Count));

        if (top.Count == 0)
        {
            ListPanel.Children.Add(UiFactory.Secondary("Задач нет — добавьте первую ниже."));
            return;
        }

        foreach (var task in top)
            ListPanel.Children.Add(BuildRow(task));
    }

    private UIElement BuildRow(TaskItem task)
    {
        var row = new Grid { ColumnSpacing = 8 };
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        var check = new CheckBox { MinWidth = 0, Padding = new Thickness(0), IsChecked = false };
        check.Checked += async (_, _) => await App.Hub.CompleteTaskAsync(task, true);
        check.IsEnabled = App.Hub.TaskSource is { CanComplete: true };
        row.Children.Add(check);

        var right = new StackPanel();
        var titleRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 6 };
        if (task.IsImportant)
        {
            var star = UiFactory.Icon("\uE735", 10);
            star.Foreground = UiFactory.AccentBrush();
            star.VerticalAlignment = VerticalAlignment.Center;
            titleRow.Children.Add(star);
        }
        titleRow.Children.Add(UiFactory.Text(task.Title));
        right.Children.Add(titleRow);

        if (task.HasDue)
        {
            var due = UiFactory.Secondary(task.DueDisplay, 11);
            if (task.IsOverdue) due.Foreground = UiFactory.ErrorBrush();
            right.Children.Add(due);
        }
        Grid.SetColumn(right, 1);
        row.Children.Add(right);
        return row;
    }

    private async void OnNewTaskKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key != Windows.System.VirtualKey.Enter) return;
        var title = NewTaskBox.Text.Trim();
        if (title.Length == 0) return;
        NewTaskBox.Text = "";
        await App.Hub.AddTaskAsync(title);
    }
}
