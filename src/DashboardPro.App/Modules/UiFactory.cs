using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace DashboardPro.App.Modules;

/// <summary>Мелкие помощники для построения строк модулей в коде.</summary>
internal static class UiFactory
{
    public static Brush SecondaryBrush(FrameworkElement scope) =>
        (Brush)Application.Current.Resources["TextFillColorSecondaryBrush"];

    public static Brush AccentBrush() =>
        (Brush)Application.Current.Resources["AccentFillColorDefaultBrush"];

    public static Brush ErrorBrush() =>
        (Brush)Application.Current.Resources["SystemFillColorCriticalBrush"];

    public static TextBlock Text(string text, double size = 13) =>
        new() { Text = text, FontSize = size, TextWrapping = TextWrapping.Wrap };

    public static TextBlock Secondary(string text, double size = 12) =>
        new()
        {
            Text = text,
            FontSize = size,
            TextWrapping = TextWrapping.Wrap,
            Foreground = (Brush)Application.Current.Resources["TextFillColorSecondaryBrush"]
        };

    public static FontIcon Icon(string glyph, double size = 12) =>
        new()
        {
            Glyph = glyph,
            FontSize = size,
            Foreground = (Brush)Application.Current.Resources["TextFillColorSecondaryBrush"]
        };

    public static Button SmallIconButton(string glyph, string tooltip)
    {
        var button = new Button
        {
            Content = new FontIcon { Glyph = glyph, FontSize = 11 },
            Background = new SolidColorBrush(Microsoft.UI.Colors.Transparent),
            BorderThickness = new Thickness(0),
            Padding = new Thickness(4),
            MinWidth = 0,
            MinHeight = 0
        };
        ToolTipService.SetToolTip(button, tooltip);
        return button;
    }
}
