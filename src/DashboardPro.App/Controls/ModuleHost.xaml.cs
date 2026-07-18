using DashboardPro.App.Modules;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;

namespace DashboardPro.App.Controls;

public sealed partial class ModuleHost : UserControl
{
    private ModuleItem? _item;

    public ModuleHost()
    {
        InitializeComponent();
        DataContextChanged += (_, args) =>
        {
            if (args.NewValue is ModuleItem item && !ReferenceEquals(item, _item))
                Bind(item);
        };
    }

    private void Bind(ModuleItem item)
    {
        _item = item;
        Icon.Glyph = item.Descriptor.Glyph;
        TitleText.Text = item.Descriptor.Title;
        Body.Content = item.View;
        SettingsButton.Visibility = item.Descriptor.SettingsSchema is { Count: > 0 }
            ? Visibility.Visible : Visibility.Collapsed;
        ApplyCollapsed(item.Config.Collapsed);
    }

    private void ApplyCollapsed(bool collapsed)
    {
        Body.Visibility = collapsed ? Visibility.Collapsed : Visibility.Visible;
        CollapseIcon.Glyph = collapsed ? "\uE70D" : "\uE70E"; // ChevronDown / ChevronUp
    }

    private void OnCollapseClick(object sender, RoutedEventArgs e)
    {
        if (_item is null) return;
        _item.Config.Collapsed = !_item.Config.Collapsed;
        ApplyCollapsed(_item.Config.Collapsed);
        App.Settings.Save();
    }

    private void OnCloseClick(object sender, RoutedEventArgs e)
    {
        if (_item is not null) App.Window?.DisableModule(_item);
    }

    private void OnSettingsClick(object sender, RoutedEventArgs e)
    {
        if (_item?.Descriptor.SettingsSchema is not { Count: > 0 } schema) return;

        var panel = new StackPanel { Spacing = 8, MinWidth = 260 };
        var boxes = new Dictionary<string, TextBox>();
        foreach (var field in schema)
        {
            panel.Children.Add(new TextBlock { Text = field.Label, FontSize = 12 });
            var box = new TextBox
            {
                PlaceholderText = field.Placeholder,
                Text = ModuleItem.GetString(_item.Config, field.Key)
            };
            boxes[field.Key] = box;
            panel.Children.Add(box);
        }

        var flyout = new Flyout { Content = panel, Placement = FlyoutPlacementMode.Bottom };

        var save = new Button
        {
            Content = "Сохранить",
            Style = (Style)Application.Current.Resources["AccentButtonStyle"],
            Margin = new Thickness(0, 4, 0, 0)
        };
        save.Click += (_, _) =>
        {
            foreach (var (key, box) in boxes)
            {
                if (string.IsNullOrWhiteSpace(box.Text)) _item.Config.Settings.Remove(key);
                else _item.Config.Settings[key] = box.Text.Trim();
            }
            App.Settings.Save();
            (_item.View as IModuleControl)?.OnSettingsChanged();
            flyout.Hide();
        };
        panel.Children.Add(save);

        flyout.ShowAt((FrameworkElement)sender);
    }
}
