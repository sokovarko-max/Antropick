using System.Collections.ObjectModel;
using System.Collections.Specialized;
using DashboardPro.App.Interop;
using DashboardPro.App.Modules;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace DashboardPro.App;

public sealed partial class MainWindow : Window
{
    public ObservableCollection<ModuleItem> Modules { get; } = new();

    private readonly AppBarHelper _appBar = new();
    private readonly IntPtr _hwnd;
    private bool _rebuilding;

    public MainWindow()
    {
        InitializeComponent();
        Title = "Dashboard Pro";
        _hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);

        BuildModules();
        ModulesList.ItemsSource = Modules;
        Modules.CollectionChanged += OnModulesReordered;

        ApplyWindowSettings();
        Closed += (_, _) =>
        {
            _appBar.Unregister();
            App.Settings.Save();
        };
    }

    // ---------- Окно ----------

    public void ApplyWindowSettings()
    {
        var s = App.Settings.Current;

        if (AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.SetBorderAndTitleBar(false, false);
            presenter.IsResizable = false;
            presenter.IsMaximizable = false;
            presenter.IsMinimizable = false;
            presenter.IsAlwaysOnTop = s.AlwaysOnTop;
        }
        AppWindow.IsShownInSwitchers = s.ShowInSwitchers;

        SystemBackdrop = s.Backdrop switch
        {
            "Acrylic" => new DesktopAcrylicBackdrop(),
            "MicaAlt" => new MicaBackdrop { Kind = Microsoft.UI.Composition.SystemBackdrops.MicaKind.BaseAlt },
            "None" => null,
            _ => new MicaBackdrop()
        };

        Root.RequestedTheme = s.Theme switch
        {
            "Light" => ElementTheme.Light,
            "Dark" => ElementTheme.Dark,
            _ => ElementTheme.Default
        };
        Root.Opacity = Math.Clamp(s.Opacity, 0.3, 1.0);
        PinIcon.Glyph = s.AlwaysOnTop ? "\uE840" : "\uE718"; // Pinned / Pin

        Dock();
    }

    private void Dock()
    {
        var s = App.Settings.Current;
        var widthPx = (int)Math.Round(s.SidebarWidth * WindowInterop.GetScale(_hwnd));

        if (s.ReserveScreenSpace)
        {
            var outer = DisplayArea.GetFromWindowId(AppWindow.Id, DisplayAreaFallback.Nearest).OuterBounds;
            var rect = _appBar.Register(_hwnd, widthPx, outer);
            AppWindow.MoveAndResize(new Windows.Graphics.RectInt32(rect.X, rect.Y, rect.Width, rect.Height));
        }
        else
        {
            _appBar.Unregister();
            WindowInterop.DockRight(AppWindow, _hwnd, s.SidebarWidth);
        }
    }

    // ---------- Модули ----------

    private void BuildModules()
    {
        _rebuilding = true;
        Modules.Clear();

        // Гарантируем, что в настройках есть запись для каждого известного модуля,
        // сохраняя пользовательский порядок
        foreach (var d in ModuleRegistry.All)
            App.Settings.GetModuleConfig(d.Id);

        foreach (var cfg in App.Settings.Current.Modules)
        {
            var descriptor = ModuleRegistry.Find(cfg.Id);
            if (descriptor is not null && cfg.Enabled)
                Modules.Add(new ModuleItem(descriptor, cfg));
        }
        _rebuilding = false;
    }

    public void RebuildModules() => BuildModules();

    private void OnModulesReordered(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (_rebuilding) return;
        // Новый порядок: включённые — как на панели, выключенные — в конце
        var ordered = Modules.Select(m => m.Config).ToList();
        ordered.AddRange(App.Settings.Current.Modules.Where(c => !ordered.Contains(c)));
        App.Settings.Current.Modules = ordered;
        App.Settings.Save();
    }

    public void DisableModule(ModuleItem item)
    {
        item.Config.Enabled = false;
        Modules.Remove(item);
        App.Settings.Save();
    }

    private void OnAddModuleClick(object sender, RoutedEventArgs e)
    {
        var flyout = new MenuFlyout();
        var hidden = ModuleRegistry.All
            .Where(d => !Modules.Any(m => m.Descriptor.Id == d.Id))
            .ToList();

        if (hidden.Count == 0)
        {
            flyout.Items.Add(new MenuFlyoutItem { Text = "Все модули уже на панели", IsEnabled = false });
        }
        else
        {
            foreach (var d in hidden)
            {
                var item = new MenuFlyoutItem
                {
                    Text = d.Title,
                    Icon = new FontIcon { Glyph = d.Glyph }
                };
                item.Click += (_, _) =>
                {
                    var cfg = App.Settings.GetModuleConfig(d.Id);
                    cfg.Enabled = true;
                    Modules.Add(new ModuleItem(d, cfg));
                    App.Settings.Save();
                };
                flyout.Items.Add(item);
            }
        }
        flyout.ShowAt((FrameworkElement)sender);
    }

    private void OnPinClick(object sender, RoutedEventArgs e)
    {
        App.Settings.Current.AlwaysOnTop = !App.Settings.Current.AlwaysOnTop;
        App.Settings.Save();
        ApplyWindowSettings();
    }

    private void OnSettingsClick(object sender, RoutedEventArgs e)
    {
        new SettingsWindow().Activate();
    }

    // ---------- Глобальный поиск ----------

    private void OnSearchTextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
    {
        if (args.Reason != AutoSuggestionBoxTextChangeReason.UserInput) return;
        var q = sender.Text.Trim();
        if (q.Length < 2)
        {
            sender.ItemsSource = null;
            return;
        }

        var results = new List<string>();
        results.AddRange(App.Hub.Tasks
            .Where(t => t.Title.Contains(q, StringComparison.OrdinalIgnoreCase))
            .Take(5).Select(t => $"Задача: {t.Title}"));
        results.AddRange(App.Hub.Events
            .Where(ev => ev.Title.Contains(q, StringComparison.OrdinalIgnoreCase))
            .Take(5).Select(ev => $"Событие: {ev.Title} ({ev.Start:d MMM HH:mm})"));
        results.AddRange(App.Hub.Notes
            .Where(n => n.Title.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                        n.Content.Contains(q, StringComparison.OrdinalIgnoreCase))
            .Take(5).Select(n => $"Заметка: {n.Title}"));
        results.AddRange(App.Store.GetProjects()
            .Where(p => p.Name.Contains(q, StringComparison.OrdinalIgnoreCase))
            .Take(3).Select(p => $"Проект: {p.Name}"));

        sender.ItemsSource = results.Count > 0 ? results : new List<string> { "Ничего не найдено" };
    }
}
