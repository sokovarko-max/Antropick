using DashboardPro.Core.DataSources;
using DashboardPro.Core.Services;
using DashboardPro.App.Services;
using Microsoft.UI.Xaml;
using Microsoft.Windows.AppNotifications;

namespace DashboardPro.App;

public partial class App : Application
{
    public static SettingsService Settings { get; private set; } = null!;
    public static LocalStore Store { get; private set; } = null!;
    public static SourceFactory Sources { get; private set; } = null!;
    public static DataHub Hub { get; private set; } = null!;
    public static MainWindow? Window { get; private set; }

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        Settings = new SettingsService();
        Store = new LocalStore(Settings.DataFolder);
        Sources = new SourceFactory(Store);
        Sources.LoadPlugins(Path.Combine(Settings.DataFolder, "Plugins"));
        Hub = new DataHub(Settings, Sources);
        Hub.Start();

        try { AppNotificationManager.Default.Register(); } catch { /* уведомления недоступны — не критично */ }

        AutostartService.Apply(Settings.Current.Autostart);

        Window = new MainWindow();
        Window.Activate();
    }
}
