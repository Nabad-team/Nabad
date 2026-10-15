import { useEffect, useRef, useState } from "react";
import { providerText as t } from "../lib/providerText";
import { groupMapProviders } from "../lib/providerMap";

export default function ProviderMap({ providers }) {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);
  const locations = JSON.stringify(providers.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })));
  useEffect(() => {
    let active = true;
    let map;
    setFailed(false);
    import("leaflet").then(module => {
      if (!active || !container.current) return;
      const L = module.default || module;
      map = L.map(container.current, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([33.9, 35.6], 8);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on("tileerror", () => { if (active) setFailed(true); }).addTo(map);
      const groups = groupMapProviders(JSON.parse(locations));
      const points = [];
      for (const group of groups) {
        const point = [group[0].latitude, group[0].longitude]; points.push(point);
        const content = document.createElement("div");
        for (const provider of group) {
          const paragraph = document.createElement("p");
          const link = document.createElement("a");
          link.href = `#provider-${provider.id}`;
          link.textContent = provider.name; // facility data is text, never executable popup HTML
          link.addEventListener("click", () => document.getElementById(`provider-${provider.id}`)?.focus());
          paragraph.append(link); content.append(paragraph);
        }
        L.marker(point, { title: group.map(p => p.name).join(", "), keyboard: true,
          icon: L.divIcon({ className: "provider-pin", html: String(group.length), iconSize: [32, 32], iconAnchor: [16, 16] })
        }).bindPopup(content).addTo(map);
      }
      if (points.length) map.fitBounds(points, { padding: [30, 30], maxZoom: 14, animate: false });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (map) map.remove(); };
  }, [locations]);
  return <section aria-label={t("mapTitle")}>
    <p>{t("mapNotice")}</p>
    {failed && <p role="alert">{t("mapError")}</p>}
    <div ref={container} className="provider-map" aria-label={t("mapTitle")} />
  </section>;
}
