using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Shapes;

namespace DashboardPro.App.Modules;

/// <summary>Трекер привычек: отметка на сегодня + последние 7 дней точками.</summary>
public sealed partial class HabitsModule : UserControl
{
    public HabitsModule(ModuleConfig config)
    {
        InitializeComponent();
        Loaded += (_, _) => Render();
    }

    private void Render()
    {
        ListPanel.Children.Clear();
        var habits = App.Store.GetHabits();
        if (habits.Count == 0)
        {
            ListPanel.Children.Add(UiFactory.Secondary("Добавьте первую привычку ниже."));
            return;
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        var weekStart = today.AddDays(-6);

        foreach (var habit in habits)
        {
            var days = App.Store.GetHabitDays(habit.Id, weekStart, today);

            var row = new Grid { ColumnSpacing = 8 };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var check = new CheckBox
            {
                MinWidth = 0,
                Padding = new Thickness(0),
                IsChecked = days.Contains(today)
            };
            check.Checked += (_, _) => { App.Store.SetHabitDone(habit.Id, today, true); Render(); };
            check.Unchecked += (_, _) => { App.Store.SetHabitDone(habit.Id, today, false); Render(); };
            row.Children.Add(check);

            var name = UiFactory.Text(habit.Name);
            name.VerticalAlignment = VerticalAlignment.Center;
            Grid.SetColumn(name, 1);
            row.Children.Add(name);

            var dots = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Spacing = 4,
                VerticalAlignment = VerticalAlignment.Center
            };
            for (var i = 0; i < 7; i++)
            {
                var day = weekStart.AddDays(i);
                var done = days.Contains(day);
                dots.Children.Add(new Ellipse
                {
                    Width = 7,
                    Height = 7,
                    Fill = done ? UiFactory.AccentBrush() : null,
                    Stroke = (Brush)Application.Current.Resources["TextFillColorTertiaryBrush"],
                    StrokeThickness = done ? 0 : 1
                });
            }
            Grid.SetColumn(dots, 2);
            row.Children.Add(dots);

            var delete = UiFactory.SmallIconButton("\uE74D", "Удалить привычку");
            delete.Click += (_, _) => { App.Store.DeleteHabit(habit.Id); Render(); };
            Grid.SetColumn(delete, 3);
            row.Children.Add(delete);

            ListPanel.Children.Add(row);
        }
    }

    private void OnAddClick(object sender, RoutedEventArgs e) => AddHabit();

    private void OnNewHabitKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter) AddHabit();
    }

    private void AddHabit()
    {
        var name = NewHabitBox.Text.Trim();
        if (name.Length == 0) return;
        App.Store.AddHabit(name);
        NewHabitBox.Text = "";
        Render();
    }
}
