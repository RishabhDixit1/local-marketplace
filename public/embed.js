(function () {
  var WIDGET_API_BASE = "https://www.serviq.in/api/widgets";
  var CONTAINER_SELECTOR = "[data-serviq-widget]";

  function findWidgetContainers() {
    return document.querySelectorAll(CONTAINER_SELECTOR);
  }

  function fetchWidgetData(widgetId) {
    return fetch(WIDGET_API_BASE + "/" + widgetId + "/public")
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.message || "Widget fetch failed");
        return res;
      });
  }

  function createProfileCard(data) {
    var p = data.provider;
    var c = data.config || {};
    var theme = c.theme || "light";
    var primaryColor = c.primaryColor || "#2563eb";

    var card = document.createElement("div");
    card.style.cssText =
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "max-width:360px;border-radius:12px;overflow:hidden;" +
      "box-shadow:0 1px 3px rgba(0,0,0,0.1),0 1px 2px rgba(0,0,0,0.06);" +
      "background:" + (theme === "dark" ? "#1f2937" : "#fff") + ";" +
      "color:" + (theme === "dark" ? "#f9fafb" : "#111827") + ";" +
      "border:1px solid " + (theme === "dark" ? "#374151" : "#e5e7eb") + ";" +
      "transition:box-shadow 0.2s;";

    var inner = "";

    inner += '<div style="padding:20px;">';

    inner += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
    if (p.avatar) {
      inner += '<img src="' + escapeAttr(p.avatar) + '" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;">';
    } else {
      inner += '<div style="width:48px;height:48px;border-radius:50%;background:' + primaryColor + ';display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:#fff;flex-shrink:0;">' + escapeHtml((p.name || "?").charAt(0)) + '</div>';
    }
    inner += '<div style="flex:1;min-width:0;">';
    inner += '<div style="font-size:16px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(p.name || "Service Provider") + '</div>';
    if (p.locality) {
      inner += '<div style="font-size:13px;color:' + (theme === "dark" ? "#9ca3af" : "#6b7280") + ';margin-top:2px;">📍 ' + escapeHtml(p.locality) + '</div>';
    }
    inner += "</div>";

    inner += '<div style="text-align:right;flex-shrink:0;">';
    if (p.rating) {
      inner += '<div style="font-size:18px;font-weight:700;">⭐ ' + Number(p.rating).toFixed(1) + '</div>';
    }
    if (p.trustScore) {
      inner += '<div style="font-size:12px;color:' + (theme === "dark" ? "#9ca3af" : "#6b7280") + ';">Trust ' + p.trustScore + '%</div>';
    }
    inner += "</div>";
    inner += "</div>";

    if (p.bio) {
      inner += '<p style="font-size:14px;line-height:1.5;margin:0 0 12px;color:' + (theme === "dark" ? "#d1d5db" : "#4b5563") + ';">' + escapeHtml(p.bio) + '</p>';
    }

    inner += '<div style="display:flex;gap:12px;font-size:13px;color:' + (theme === "dark" ? "#9ca3af" : "#6b7280") + ';">';
    inner += '<span>📋 ' + (p.servicesCount || 0) + ' services</span>';
    if (p.zip) inner += '<span>📮 ' + escapeHtml(p.zip) + '</span>';
    inner += "</div>";

    inner += '<a href="https://www.serviq.in/business/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:14px;padding:8px 16px;border-radius:6px;background:' + primaryColor + ';color:#fff;text-decoration:none;text-align:center;font-size:14px;font-weight:500;">View Profile →</a>';

    inner += "</div>";

    card.innerHTML = inner;
    return card;
  }

  function escapeHtml(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return "";
    return str.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function init() {
    var containers = findWidgetContainers();
    containers.forEach(function (el) {
      var widgetId = el.getAttribute("data-serviq-widget");
      if (!widgetId) return;

      fetchWidgetData(widgetId)
        .then(function (data) {
          var card = createProfileCard(data);
          el.appendChild(card);
        })
        .catch(function (err) {
          el.innerHTML = '<div style="padding:16px;border:1px solid #fca5a5;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:14px;">ServiQ widget unavailable</div>';
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
