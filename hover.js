// satellite-hover.js

/**
 * HUD hiển thị thông tin khi hover lên vệ tinh
 * @param {Cesium.Viewer} viewer - Viewer của Cesium
 * @param {Array} createdSats - Danh sách vệ tinh (entities)
 */
export function setupHoverHUD(viewer, createdSats) {
    // Tạo HUD DOM
    const satHud = document.createElement("div");
    satHud.style.position = "absolute";
    satHud.style.background = "rgba(0,0,0,0.7)";
    satHud.style.color = "#0ff";
    satHud.style.padding = "6px 10px";
    satHud.style.borderRadius = "6px";
    satHud.style.font = "12px monospace";
    satHud.style.whiteSpace = "pre";
    satHud.style.display = "none";
    document.body.appendChild(satHud);
  
    // Handler hover
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);
  
      // Nếu không pick được vệ tinh hợp lệ → ẩn HUD + ẩn label
      if (!Cesium.defined(picked) || !createdSats.includes(picked.id)) {
        satHud.style.display = "none";
        viewer.entities.values.forEach(ent => {
          if (ent.satrec && ent.label) ent.label.show = false;
        });
        return;
      }
  
      const sat = picked.id;
      sat.label.show = true; // bật label khi hover
  
      // Lấy vị trí vệ tinh
      const now = Cesium.JulianDate.now();
      const pos = sat.position.getValue(now);
      if (!pos) {
        satHud.innerText = `SATELLITE: ${sat.id}\n(No position data yet)`;
        satHud.style.left = movement.endPosition.x + 15 + "px";
        satHud.style.top = movement.endPosition.y + 15 + "px";
        satHud.style.display = "block";
        return;
      }
  
      // Tính thông tin quỹ đạo
      const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos);
      const altKm = (carto.height / 1000).toFixed(1);
      const orbitalPeriod = (
        2 * Math.PI * Math.sqrt(Math.pow(6371 + +altKm, 3) / 398600)
      ).toFixed(1);
  
      // Nếu muốn hiển thị elevation/azimuth từ beam connection:
      let elDeg = undefined;
      let azDeg = undefined;
      if (sat.connection) {
        // lấy GS đầu tiên có connection làm ví dụ
        const firstGS = Object.values(sat.connection).find(c => c.los);
        if (firstGS) {
          elDeg = firstGS.elevation.toFixed(2);
          azDeg = firstGS.azimuth.toFixed(2);
        }
      }
  
      // Cập nhật HUD
      satHud.style.left = movement.endPosition.x + 15 + "px";
      satHud.style.top = movement.endPosition.y + 15 + "px";
      satHud.innerText =
        `SATELLITE: ${sat.id}\n` +
        `Altitude: ${altKm} km\n` +
        `Orbital period: ${orbitalPeriod} min` +
        (elDeg !== undefined && azDeg !== undefined
          ? `\nElevation: ${elDeg}°\nAzimuth: ${azDeg}°`
          : "");
      satHud.style.display = "block";
  
      // Debug log
      console.log("HUD:", sat.name, "Alt=", altKm, "km", "Period=", orbitalPeriod, "min");
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }
  