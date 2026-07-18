using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;

namespace DashboardPro.App.Modules;

/// <summary>Проекты: прогресс, дедлайн, следующий шаг. Редактирование — через карандаш.</summary>
public sealed partial class ProjectsModule : UserControl
{
    public ProjectsModule(ModuleConfig config)
    {
        InitializeComponent();
        Loaded += (_, _) => Render();
    }

    private void Render()
    {
        ListPanel.Children.Clear();
        var projects = App.Store.GetProjects();
        if (projects.Count == 0)
        {
            ListPanel.Children.Add(UiFactory.Secondary("Проектов пока нет."));
            return;
        }

        foreach (var project in projects)
        {
            var panel = new StackPanel { Spacing = 3 };

            var header = new Grid { ColumnSpacing = 6 };
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var name = UiFactory.Text(project.Name);
            name.FontWeight = Microsoft.UI.Text.FontWeights.SemiBold;
            header.Children.Add(name);

            var edit = UiFactory.SmallIconButton("\uE70F", "Изменить проект");
            edit.Click += (_, _) => ShowEditFlyout(edit, project);
            Grid.SetColumn(edit, 1);
            header.Children.Add(edit);

            var delete = UiFactory.SmallIconButton("\uE74D", "Удалить проект");
            delete.Click += (_, _) => { App.Store.DeleteProject(project.Id); Render(); };
            Grid.SetColumn(delete, 2);
            header.Children.Add(delete);
            panel.Children.Add(header);

            panel.Children.Add(new ProgressBar { Minimum = 0, Maximum = 100, Value = project.Progress });
            panel.Children.Add(UiFactory.Secondary(project.StatsDisplay, 11));
            if (!string.IsNullOrWhiteSpace(project.NextStep))
                panel.Children.Add(UiFactory.Secondary($"Следующий шаг: {project.NextStep}", 11));

            ListPanel.Children.Add(panel);
        }
    }

    private void ShowEditFlyout(FrameworkElement anchor, Project project)
    {
        var panel = new StackPanel { Spacing = 8, MinWidth = 240 };
        var nameBox = new TextBox { Header = "Название", Text = project.Name };
        var deadlineBox = new TextBox
        {
            Header = "Дедлайн (гггг-мм-дд)",
            Text = project.Deadline?.ToString("yyyy-MM-dd") ?? "",
            PlaceholderText = "2026-08-01"
        };
        var totalBox = new NumberBox { Header = "Всего задач", Value = project.TotalTasks, Minimum = 0 };
        var doneBox = new NumberBox { Header = "Сделано", Value = project.DoneTasks, Minimum = 0 };
        var stepBox = new TextBox { Header = "Следующий шаг", Text = project.NextStep ?? "" };
        panel.Children.Add(nameBox);
        panel.Children.Add(deadlineBox);
        panel.Children.Add(totalBox);
        panel.Children.Add(doneBox);
        panel.Children.Add(stepBox);

        var flyout = new Flyout { Content = panel, Placement = FlyoutPlacementMode.Left };
        var save = new Button
        {
            Content = "Сохранить",
            Style = (Style)Application.Current.Resources["AccentButtonStyle"]
        };
        save.Click += (_, _) =>
        {
            project.Name = nameBox.Text.Trim();
            project.Deadline = DateTime.TryParse(deadlineBox.Text.Trim(), out var d) ? d : null;
            project.TotalTasks = (int)totalBox.Value;
            project.DoneTasks = (int)doneBox.Value;
            project.NextStep = string.IsNullOrWhiteSpace(stepBox.Text) ? null : stepBox.Text.Trim();
            App.Store.UpdateProject(project);
            flyout.Hide();
            Render();
        };
        panel.Children.Add(save);
        flyout.ShowAt(anchor);
    }

    private void OnAddClick(object sender, RoutedEventArgs e) => AddProject();

    private void OnNewProjectKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter) AddProject();
    }

    private void AddProject()
    {
        var name = NewProjectBox.Text.Trim();
        if (name.Length == 0) return;
        App.Store.AddProject(name);
        NewProjectBox.Text = "";
        Render();
    }
}
