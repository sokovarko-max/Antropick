using System.Xml.Linq;

namespace DashboardPro.Core.DataSources;

public sealed record RssItem(string Title, string? Link, DateTime? Published);

/// <summary>Чтение RSS 2.0 и Atom-лент без внешних зависимостей.</summary>
public static class RssClient
{
    private static readonly HttpClient Http = new();

    public static async Task<IReadOnlyList<RssItem>> FetchAsync(string url, CancellationToken ct = default)
    {
        var xml = await Http.GetStringAsync(url, ct);
        var doc = XDocument.Parse(xml);
        var items = new List<RssItem>();

        // RSS 2.0
        foreach (var item in doc.Descendants().Where(e => e.Name.LocalName == "item"))
        {
            var title = item.Elements().FirstOrDefault(e => e.Name.LocalName == "title")?.Value.Trim();
            if (string.IsNullOrEmpty(title)) continue;
            var link = item.Elements().FirstOrDefault(e => e.Name.LocalName == "link")?.Value.Trim();
            var pub = item.Elements().FirstOrDefault(e => e.Name.LocalName == "pubDate")?.Value;
            items.Add(new RssItem(title, link, ParseDate(pub)));
        }

        // Atom
        if (items.Count == 0)
        {
            foreach (var entry in doc.Descendants().Where(e => e.Name.LocalName == "entry"))
            {
                var title = entry.Elements().FirstOrDefault(e => e.Name.LocalName == "title")?.Value.Trim();
                if (string.IsNullOrEmpty(title)) continue;
                var link = entry.Elements().FirstOrDefault(e => e.Name.LocalName == "link")
                    ?.Attribute("href")?.Value;
                var pub = (entry.Elements().FirstOrDefault(e => e.Name.LocalName == "published")
                           ?? entry.Elements().FirstOrDefault(e => e.Name.LocalName == "updated"))?.Value;
                items.Add(new RssItem(title, link, ParseDate(pub)));
            }
        }

        return items
            .OrderByDescending(i => i.Published ?? DateTime.MinValue)
            .ToList();
    }

    private static DateTime? ParseDate(string? value) =>
        DateTime.TryParse(value, out var d) ? d : null;
}
