using System.Text.Json;
using DashboardPro.Core.Models;

namespace DashboardPro.Core.DataSources;

/// <summary>OpenWeather (openweathermap.org), бесплатный ключ на их сайте.</summary>
public sealed class OpenWeatherProvider(string apiKey, string city) : IWeatherProvider
{
    private static readonly HttpClient Http = new();

    public string Name => "OpenWeather";

    public async Task<WeatherInfo> GetWeatherAsync(CancellationToken ct = default)
    {
        var url = $"https://api.openweathermap.org/data/2.5/weather?q={Uri.EscapeDataString(city)}&appid={apiKey}&units=metric&lang=ru";
        using var doc = JsonDocument.Parse(await Http.GetStringAsync(url, ct));
        var root = doc.RootElement;
        var main = root.GetProperty("main");
        return new WeatherInfo
        {
            City = root.GetProperty("name").GetString() ?? city,
            Temperature = main.GetProperty("temp").GetDouble(),
            FeelsLike = main.GetProperty("feels_like").GetDouble(),
            Humidity = main.GetProperty("humidity").GetInt32(),
            WindSpeed = root.GetProperty("wind").GetProperty("speed").GetDouble(),
            Description = root.GetProperty("weather")[0].GetProperty("description").GetString() ?? "",
            UpdatedAt = DateTime.Now
        };
    }
}

/// <summary>WeatherAPI.com, бесплатный ключ на их сайте.</summary>
public sealed class WeatherApiProvider(string apiKey, string city) : IWeatherProvider
{
    private static readonly HttpClient Http = new();

    public string Name => "WeatherAPI";

    public async Task<WeatherInfo> GetWeatherAsync(CancellationToken ct = default)
    {
        var url = $"https://api.weatherapi.com/v1/current.json?key={apiKey}&q={Uri.EscapeDataString(city)}&lang=ru";
        using var doc = JsonDocument.Parse(await Http.GetStringAsync(url, ct));
        var root = doc.RootElement;
        var cur = root.GetProperty("current");
        return new WeatherInfo
        {
            City = root.GetProperty("location").GetProperty("name").GetString() ?? city,
            Temperature = cur.GetProperty("temp_c").GetDouble(),
            FeelsLike = cur.GetProperty("feelslike_c").GetDouble(),
            Humidity = cur.GetProperty("humidity").GetInt32(),
            WindSpeed = cur.GetProperty("wind_kph").GetDouble() / 3.6,
            Description = cur.GetProperty("condition").GetProperty("text").GetString() ?? "",
            UpdatedAt = DateTime.Now
        };
    }
}
