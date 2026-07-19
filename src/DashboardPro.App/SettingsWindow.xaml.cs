using DashboardPro.App.Modules;
using DashboardPro.App.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App;

public sealed partial class SettingsWindow : Window
{
    private readonly Dictionary<string, ToggleSwitch> _moduleToggles = new();

    public SettingsWindow()
    {
        InitializeComponent();
        Title = "Dashboard Pro — настройки";
        AppWindow.Resize(new Windows.Graphics.SizeInt32(520, 760));
        SystemBackdrop = new Microsoft.UI.Xaml.Media.MicaBackdrop();
        LoadValues();
    }

    private void LoadValues()
    {
        var s = App.Settings.Current;

        WidthBox.Value = s.SidebarWidth;
        MonitorBox.Value = s.MonitorIndex;
        SelectByTag(EdgeBox, s.DockEdge);
        TopmostToggle.IsOn = s.AlwaysOnTop;
        ReserveToggle.IsOn = s.ReserveScreenSpace;
        AutostartToggle.IsOn = s.Autostart;
        SwitchersToggle.IsOn = s.ShowInSwitchers;
        OpacitySlider.Value = s.Opacity * 100;
        RefreshBox.Value = s.DataRefreshMinutes;

        SelectByTag(BackdropBox, s.Backdrop);
        SelectByTag(ThemeBox, s.Theme);
        SelectByTag(TaskSourceBox, Get(s.TaskSource, "type", "local"));
        SelectByTag(CalendarSourceBox, Get(s.CalendarSource, "type", "none"));
        SelectByTag(NotesSourceBox, Get(s.NotesSource, "type", "local"));

        TaskPathBox.Text = Get(s.TaskSource, "path", "");
        TaskTokenBox.Password = Get(s.TaskSource, "token", "");
        IcsUrlBox.Text = Get(s.CalendarSource, "url", "");
        NotesPathBox.Text = Get(s.NotesSource, "path", "");

        ModulesPanel.Children.Clear();
        _moduleToggles.Clear();
        foreach (var d in ModuleRegistry.All)
        {
            var cfg = App.Settings.GetModuleConfig(d.Id);
            var toggle = new ToggleSwitch { Header = d.Title, IsOn = cfg.Enabled };
            _moduleToggles[d.Id] = toggle;
            ModulesPanel.Children.Add(toggle);
        }
        UpdateTaskFieldVisibility();
    }

    private static string Get(Dictionary<string, string> dict, string key, string fallback) =>
        dict.TryGetValue(key, out var v) ? v : fallback;

    private static void SelectByTag(ComboBox box, string tag)
    {
        foreach (var item in box.Items.OfType<ComboBoxItem>())
        {
            if ((string)item.Tag == tag)
            {
                box.SelectedItem = item;
                return;
            }
        }
        box.SelectedIndex = 0;
    }

    private static string SelectedTag(ComboBox box) =>
        box.SelectedItem is ComboBoxItem item ? (string)item.Tag : "";

    private void OnTaskSourceChanged(object sender, SelectionChangedEventArgs e) => UpdateTaskFieldVisibility();

    private void UpdateTaskFieldVisibility()
    {
        var type = SelectedTag(TaskSourceBox);
        TaskPathBox.Visibility = type is "markdown" or "csv" ? Visibility.Visible : Visibility.Collapsed;
        TaskTokenBox.Visibility = type is "todoist" ? Visibility.Visible : Visibility.Collapsed;
    }

    private void OnSaveClick(object sender, RoutedEventArgs e)
    {
        var s = App.Settings.Current;

        s.SidebarWidth = (int)WidthBox.Value;
        s.DockEdge = SelectedTag(EdgeBox);
        s.MonitorIndex = (int)MonitorBox.Value;
        s.AlwaysOnTop = TopmostToggle.IsOn;
        s.ReserveScreenSpace = ReserveToggle.IsOn;
        s.Autostart = AutostartToggle.IsOn;
        s.ShowInSwitchers = SwitchersToggle.IsOn;
        s.Backdrop = SelectedTag(BackdropBox);
        s.Theme = SelectedTag(ThemeBox);
        s.Opacity = OpacitySlider.Value / 100.0;
        s.DataRefreshMinutes = (int)RefreshBox.Value;

        s.TaskSource = new Dictionary<string, string> { ["type"] = SelectedTag(TaskSourceBox) };
        if (!string.IsNullOrWhiteSpace(TaskPathBox.Text)) s.TaskSource["path"] = TaskPathBox.Text.Trim();
        if (!string.IsNullOrWhiteSpace(TaskTokenBox.Password)) s.TaskSource["token"] = TaskTokenBox.Password.Trim();

        s.CalendarSource = new Dictionary<string, string> { ["type"] = SelectedTag(CalendarSourceBox) };
        if (!string.IsNullOrWhiteSpace(IcsUrlBox.Text)) s.CalendarSource["url"] = IcsUrlBox.Text.Trim();

        s.NotesSource = new Dictionary<string, string> { ["type"] = SelectedTag(NotesSourceBox) };
        if (!string.IsNullOrWhiteSpace(NotesPathBox.Text)) s.NotesSource["path"] = NotesPathBox.Text.Trim();

        foreach (var (id, toggle) in _moduleToggles)
            App.Settings.GetModuleConfig(id).Enabled = toggle.IsOn;

        App.Settings.Save();
        AutostartService.Apply(s.Autostart);

        App.Window?.RebuildModules();
        App.Window?.ApplyWindowSettings();
        App.Hub.Restart();
    }

    private void OnCloseClick(object sender, RoutedEventArgs e) => Close();
}
