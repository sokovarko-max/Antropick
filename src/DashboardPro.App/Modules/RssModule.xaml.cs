using System.Diagnostics;
using DashboardPro.Core.DataSources;
using DashboardPro.Core.Models;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

/// <summary>Заголовки из RSS/Atom-ленты; клик открывает статью в браузере.</summary>
public sealed partial class RssModule : UserControl, IModuleControl
{
    private readonly ModuleConfig _config;
    private readonly DispatcherQueueTimer _timer;

    public RssModule(ModuleConfig config)
    {
        _config = config;
        InitializeComponent();
        _timer = DispatcherQueue.CreateTimer();
        _timer.Tick += (_, _) => _ = LoadAsync();
        Loaded += (_, _) => Restart();
        Unloaded += (_, _) => _timer.Stop();
    }

    public void OnSettingsChanged() => Restart();

    private void Restart()
    {
        _timer.Stop();
        _timer.Interval = TimeSpan.FromMinutes(Math.Max(5, ModuleItem.GetInt(_config, "refreshMinutes", 30)));
        _timer.Start();
        _ = LoadAsync();
    }

    private async Task LoadAsync()
    {
        var url = ModuleItem.GetString(_config, "url");
        if (url.Length == 0)
        {
            ListPanel.Children.Clear();
            ListPanel.Children.Add(UiFactory.Secondary("Укажите URL ленты в настройках модуля (⚙)."));
            return;
        }

        try
        {
            var max = Math.Max(1, ModuleItem.GetInt(_config, "maxItems", 5));
            var items = await RssClient.FetchAsync(url);

            ListPanel.Children.Clear();
            if (items.Count == 0)
            {
                ListPanel.Children.Add(UiFactory.Secondary("Лента пуста."));
                return;
            }

            foreach (var item in items.Take(max))
            {
                var button = new HyperlinkButton
                {
                    Padding = new Thickness(0),
                    HorizontalAlignment = HorizontalAlignment.Stretch,
                    Content = new StackPanel
                    {
                        Children =
                        {
                            UiFactory.Text(item.Title),
                            UiFactory.Secondary(item.Published?.ToString("d MMM HH:mm") ?? "", 11)
                        }
                    }
                };
                if (item.Link is { } link)
                    button.Click += (_, _) =>
                    {
                        try { Process.Start(new ProcessStartInfo(link) { UseShellExecute = true }); }
                        catch { }
                    };
                ListPanel.Children.Add(button);
            }
        }
        catch (Exception ex)
        {
            ListPanel.Children.Clear();
            ListPanel.Children.Add(UiFactory.Secondary($"Не удалось загрузить ленту: {ex.Message}"));
        }
    }
}
