using DashboardPro.Core.Models;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

public sealed partial class WeatherModule : UserControl, IModuleControl
{
    private readonly ModuleConfig _config;
    private readonly DispatcherQueueTimer _timer;

    public WeatherModule(ModuleConfig config)
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
        var apiKey = ModuleItem.GetString(_config, "apiKey");
        var city = ModuleItem.GetString(_config, "city");
        if (apiKey.Length == 0 || city.Length == 0)
        {
            ShowError("Укажите API-ключ и город в настройках модуля (⚙).");
            return;
        }

        var settings = new Dictionary<string, string>(_config.Settings)
        {
            ["type"] = ModuleItem.GetString(_config, "provider", "openweather")
        };

        try
        {
            var provider = App.Sources.CreateWeatherProvider(settings)
                ?? throw new InvalidOperationException("Неизвестный провайдер погоды.");
            var w = await provider.GetWeatherAsync();

            ErrorText.Visibility = Visibility.Collapsed;
            TempText.Text = $"{Math.Round(w.Temperature)}°";
            DescText.Text = w.Description.Length > 0
                ? char.ToUpper(w.Description[0]) + w.Description[1..] : "";
            CityText.Text = w.City;
            DetailsText.Text = $"Ощущается {Math.Round(w.FeelsLike)}° • влажность {w.Humidity}% • ветер {w.WindSpeed:0.#} м/с";
        }
        catch (Exception ex)
        {
            ShowError($"Не удалось получить погоду: {ex.Message}");
        }
    }

    private void ShowError(string message)
    {
        TempText.Text = "—";
        DescText.Text = "";
        CityText.Text = "";
        DetailsText.Text = "";
        ErrorText.Text = message;
        ErrorText.Visibility = Visibility.Visible;
    }
}
