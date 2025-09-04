// groundstation.js

// ================== State & Global ==================
const state = {
    elev: 20, // default min elevation
    tiltNS: 0,
    tiltEW: 0,
    azimuth: 0,
    gsoArc: 0,
    gsoWidth: 40
  };
  window.elevMinDeg = state.elev; // 👈 global cho satellite-beam.js
  
  let stationsRef = [];
  
  // ================== Update Params ==================
  export function setGroundStationParams(elev, tiltNS, tiltEW, azimuth) {
    state.elev = elev;
    state.tiltNS = tiltNS;
    state.tiltEW = tiltEW;
    state.azimuth = azimuth;
    window.elevMinDeg = elev; // luôn update global
    // Footprint cập nhật tự động qua CallbackProperty, không cần redraw thủ công
  }
  
  function getTiltParams() {
    const tiltNS = state.tiltNS;
    const tiltEW = state.tiltEW;
    const tiltDeg = Math.sqrt(tiltNS * tiltNS + tiltEW * tiltEW);
    let tiltAz = Math.atan2(tiltEW, tiltNS); // rad
    tiltAz = Cesium.Math.toDegrees(tiltAz);
    if (tiltAz < 0) tiltAz += 360;
    return { tiltDeg, tiltAz };
  }
  
  // ================== Public API ==================
  export function setGsoArcProtection(gsoArcDeg, widthDeg = 80) {
    state.gsoArc = Math.max(0, gsoArcDeg | 0);
    state.gsoWidth = Math.max(5, Math.min(80, widthDeg | 0));
    // TODO: vẽ thêm vùng GSO arc nếu cần
  }
  
  export function setFootprintVisible(visible) {
    stationsRef?.forEach(s => { 
      if (s.coverageEntity) s.coverageEntity.show = !!visible; 
    });
  }
  
  // ================== Geometry Utils ==================
  function psiRad(R_E, alt_km, elev_deg) {
    const h = alt_km * 1000.0;
    const e = Cesium.Math.toRadians(elev_deg);
    const term = (R_E / (R_E + h)) * Math.cos(e);
    if (term > 1 || term < -1) return 0;
    return Math.acos(term) - e; // angular radius when elevation mask = elev_deg
  }
  
  function destPoint(latDeg, lonDeg, bearingDeg, angularDistRad) {
    const φ1 = Cesium.Math.toRadians(latDeg);
    const λ1 = Cesium.Math.toRadians(lonDeg);
    const θ = Cesium.Math.toRadians(bearingDeg);
    const δ = angularDistRad;
    const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
    const φ2 = Math.asin(sinφ2);
    const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
    const x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
    const λ2 = λ1 + Math.atan2(y, x);
    return { lat: Cesium.Math.toDegrees(φ2), lon: Cesium.Math.toDegrees(λ2) };
  }
  
  function ellipseCoords(R_E, altKm, elevMask, tiltDeg, azimuthDeg, lat0, lon0, steps = 120) {
    const basePsi = psiRad(R_E, altKm, elevMask);
    if (basePsi <= 0) return [];
  
    const tiltFrac = Cesium.Math.clamp(Math.abs(tiltDeg) / 30, 0.0, 1.0);
    const a = basePsi * (1 + 0.5 * tiltFrac);
    const b = basePsi * (1 - 0.3 * tiltFrac);
    const shiftDist = basePsi * 0.5 * tiltFrac;
    const center = destPoint(lat0, lon0, azimuthDeg, shiftDist);
  
    const coords = [];
    const rot = Cesium.Math.toRadians(azimuthDeg);
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
  
    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      const x = a * Math.cos(theta);
      const y = b * Math.sin(theta);
      const xr = x * cosR - y * sinR;
      const yr = x * sinR + y * cosR;
      const r = Math.sqrt(xr * xr + yr * yr);
      let bearing = Cesium.Math.toDegrees(Math.atan2(yr, xr));
      if (bearing < 0) bearing += 360;
      const p = destPoint(center.lat, center.lon, bearing, r);
      coords.push(p.lon, p.lat);
    }
    return coords;
  }
  
  // ================== Init Groundstations ==================
  export function createGroundStations(viewer, ellipsoid, R_E, options = {}) {
    const { altKm = 550 } = options;
  
    const stations = [
      { name: "Hà Nội", lon: 105.83, lat: 21.02 },
      { name: "Đà Nẵng", lon: 108.22, lat: 16.06 },
      { name: "Hồ Chí Minh", lon: 106.66, lat: 10.75 },
      { name: "Quần Đảo Hoàng Sa", lon: 111.5, lat: 16.5 },
      { name: "Quần Đảo Trường Sa", lon: 114.3, lat: 8.6 }
    ];
  
    stations.forEach((s) => {
      s.ecf = Cesium.Cartesian3.fromDegrees(s.lon, s.lat);
      s.entity = viewer.entities.add({
        position: s.ecf,
        point: { pixelSize: 10, color: Cesium.Color.AQUA, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
        label: {
          text: s.name, font: "12pt monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, 12),
        }
      });


  
    // coverage polygon
    s.coverageEntity = viewer.entities.add({
        name: "Coverage " + s.name,
        show: true, // 👈 mặc định bật
        allowPicking: false ,
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const { tiltDeg, tiltAz } = getTiltParams();
            const coords = ellipseCoords(
              R_E, altKm, state.elev,
              tiltDeg,
              tiltAz,
              s.lat, s.lon
            );
            if (coords.length === 0) {
              return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray([]));
            }
            return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(coords));
          }, false),
          material: Cesium.Color.LIME.withAlpha(0.22),
          outline: true,
          outlineColor: Cesium.Color.LIME,
          height: 0
        }
      });
  
      // cờ để toggle footprint
      s.showFootprint = true;
      
    });

  // ================== CLICK HANDLER ==================
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction(function (movement) {
    const pickedObject = viewer.scene.pick(movement.position);
    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id;
      const gs = stationsRef.find(g => g.entity === entity);
      if (gs) {
        gs.showFootprint = !gs.showFootprint;
        if (gs.coverageEntity) {
          gs.coverageEntity.show = gs.showFootprint;
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  stationsRef = stations;
  return stations;
}
  
      
  

  
