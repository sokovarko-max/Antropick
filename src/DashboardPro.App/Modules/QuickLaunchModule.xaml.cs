using System.Diagnostics;
using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

/// <summary>Быстрый запуск программ и папок (идея из Raycast / Flow Launcher).</summary>
public sealed partial class QuickLaunchModule : UserControl, IModuleControl
{
    private readonly ModuleConfig _config;

    public QuickLaunchModule(ModuleConfig config)
    {
        _config = config;
        InitializeComponent();
        Loaded += (_, _) => Render();
    }

    public void OnSettingsChanged() => Render();

    private void Render()
    {
        ListPanel.Items.Clear();
        var paths = ModuleItem.GetString(_config, "apps")
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (paths.Length == 0)
        {
            ListPanel.Items.Add(UiFactory.Secondary("Добавьте пути к программам в настройках модуля (⚙)."));
            return;
        }

        foreach (var path in paths)
        {
            var name = Path.GetFileNameWithoutExtension(path);
            if (string.IsNullOrEmpty(name)) name = path;

            var button = new Button
            {
                HorizontalAlignment = HorizontalAlignment.Stretch,
                HorizontalContentAlignment = HorizontalAlignment.Left,
                Padding = new Thickness(8, 6, 8, 6),
                Content = new StackPanel
                {
                    Orientation = Orientation.Horizontal,
                    Spacing = 8,
                    Children =
                    {
                        UiFactory.Icon(Directory.Exists(path) ? "\uE8B7" : "\uE756", 13), // Folder / App
                        UiFactory.Text(name)
                    }
                }
            };
            ToolTipService.SetToolTip(button, path);
            button.Click += (_, _) =>
            {
                try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); }
                catch { /* путь не существует — подсказка в тултипе */ }
            };
            ListPanel.Items.Add(button);
        }
    }
}
