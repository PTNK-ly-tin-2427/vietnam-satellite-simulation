// satellite-beam.js
export async function initializeSatellitesFootprint(viewer, ellipsoid, R_E, sats, groundStations) {
  let showFootprints = true;


  // UI elements (must exist in index.html)
  const hud = document.getElementById("hud");
  const satElevSlider = document.getElementById("satElevSlider");
  const hudConnection = document.getElementById("hudConnection"); 
  const satElevVal = document.getElementById("satElevVal");
  const toggleFoot = document.getElementById("toggleFoot");

  // polyline container for gateway->sat links
  const polylineCollection = new Cesium.PolylineCollection();
  viewer.scene.primitives.add(polylineCollection);

  function refreshHUD() {
      hud.textContent = 
        `Các vệ tinh đang được theo dõi: ${sats.length}\n` +
        `Các trạm mặt đất: ${groundStations ? groundStations.length : 0}\n` 

    }
    
  // wire UI
  if (toggleFoot) {
    toggleFoot.addEventListener("change", (e) => {
      showFootprints = !!e.target.checked;
    });
  }

  refreshHUD();

  // footprint math
  function psiRad(alt_km, elev_deg) {
    const h = alt_km * 1000.0;
    const e = Cesium.Math.toRadians(elev_deg);
    const term = (R_E / (R_E + h)) * Math.cos(e);
    if (term > 1 || term < -1) return 0;
    return Math.max(0, Math.acos(term) - e);
  }
  function footprintRadiusMeters(alt_km, elev_deg) {
    return psiRad(alt_km, elev_deg) * R_E;
  }

  // helpers for elevation (ENU)
  const scratchEnuTransform = new Cesium.Matrix4();
  const scratchInverseEnu = new Cesium.Matrix4();
  const scratchStationToSatVec = new Cesium.Cartesian3();
  const scratchEnuVector = new Cesium.Cartesian3();

  function calculateElevationAngle(stationEcf, satelliteEcf) {
    const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(stationEcf, ellipsoid, scratchEnuTransform);
    const stationToSatVector = Cesium.Cartesian3.subtract(satelliteEcf, stationEcf, scratchStationToSatVec);
    const inverseEnu = Cesium.Matrix4.inverse(enuTransform, scratchInverseEnu);
    const enuVector = Cesium.Matrix4.multiplyByPointAsVector(inverseEnu, stationToSatVector, scratchEnuVector);
    Cesium.Cartesian3.normalize(enuVector, enuVector);
    return Cesium.Math.toDegrees(Math.asin(enuVector.z));
  }

  // create per-satellite footprint entities
  const satFootprints = [];
// Biến global để toggle hiển thị
let showElMinFootprint = true;
let showBeamFootprint = true;

// Hàm tính footprint từ el_min
function footprintRadiusMeters(alt_km, elev_deg) {
const h = alt_km * 1000.0;
const e = Cesium.Math.toRadians(elev_deg);
const term = (R_E / (R_E + h)) * Math.cos(e);
if (term > 1 || term < -1) return 0;
return (Math.acos(term) - e) * R_E;
}

// Hàm tính footprint từ beam half-angle
function beamFootprintRadiusMeters(alt_km, beamHalfDeg) {
const alpha = Cesium.Math.toRadians(beamHalfDeg);
const r_s = R_E + alt_km * 1000.0;
const ratio = (r_s / R_E) * Math.sin(alpha);
if (ratio >= 1) return Math.PI/2 * R_E;
return Math.asin(ratio) * R_E;
}

const defaultSatBeamHalfDeg = 5.0; // chỉnh tùy vệ tinh

sats.forEach(satEntity => {
sats.forEach(satEntity => {
  if (!satEntity.subMarker) {
    satEntity.subMarker = viewer.entities.add({
      position: new Cesium.CallbackProperty(time => {
        const pos = satEntity.position?.getValue(time);
        if (!pos) return null;
        const carto = ellipsoid.cartesianToCartographic(pos);
        return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0.0, ellipsoid);
      }, false),
      point: {
        pixelSize: 4, // nhỏ hơn
        color: Cesium.Color.YELLOW.withAlpha(0.5), // transparent
        outlineWidth: 0 // bỏ outline
      },
      label: {
        font: "12px sans-serif",
        fillColor: Cesium.Color.WHITE.withAlpha(0.6),
        style: Cesium.LabelStyle.FILL, // bỏ outline
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -6)
      }
    });
  }
});
sats.forEach(satEntity => {
  // Ellipse 1: footprint el_min
  const elminFp = viewer.entities.add({
    position: new Cesium.CallbackProperty(time =>
      satEntity.position ? satEntity.position.getValue(time) : null, false),
    ellipse: {
      show: new Cesium.CallbackProperty(() => showElMinFootprint, false),
      semiMajorAxis: new Cesium.CallbackProperty(time => {
        const pos = satEntity.position?.getValue(time);
        if (!pos) return 0;
        const carto = ellipsoid.cartesianToCartographic(pos);
        return footprintRadiusMeters(carto.height/1000.0, elevMinDeg);
      }, false),
      semiMinorAxis: new Cesium.CallbackProperty(time => {
        const pos = satEntity.position?.getValue(time);
        if (!pos) return 0;
        const carto = ellipsoid.cartesianToCartographic(pos);
        return footprintRadiusMeters(carto.height/1000.0, elevMinDeg);
      }, false),
      height: 0,
      material: Cesium.Color.fromBytes(0,160,255,25),
      outline: true,
      outlineColor: Cesium.Color.fromBytes(180,220,255,180),
      outlineWidth: 2
    }
  });

  // Ellipse 2: usable beam footprint
  const beamFp = viewer.entities.add({
    position: new Cesium.CallbackProperty(time =>
      satEntity.position ? satEntity.position.getValue(time) : null, false),
    ellipse: {
      show: new Cesium.CallbackProperty(() => showBeamFootprint, false),
      semiMajorAxis: new Cesium.CallbackProperty(time => {
        const pos = satEntity.position?.getValue(time);
        if (!pos) return 0;
        const carto = ellipsoid.cartesianToCartographic(pos);
        const visR = footprintRadiusMeters(carto.height/1000.0, elevMinDeg);
        const beamR = beamFootprintRadiusMeters(carto.height/1000.0, satEntity.beamHalfDeg || defaultSatBeamHalfDeg);
        console.log(`[${satEntity.id}] Beam footprint radius = ${beamR.toFixed(0)} m (~${(beamR/1000).toFixed(1)} km)`);
        return Math.min(visR, beamR);
      }, false),
      semiMinorAxis: new Cesium.CallbackProperty(time => {
        const pos = satEntity.position?.getValue(time);
        if (!pos) return 0;
        const carto = ellipsoid.cartesianToCartographic(pos);
        const visR = footprintRadiusMeters(carto.height/1000.0, elevMinDeg);
        const beamR = beamFootprintRadiusMeters(
          carto.height/1000.0,
          satEntity.beamHalfDeg || defaultSatBeamHalfDeg
        );
        return Math.min(visR, beamR);
      }, false),
      height: 0,
      material: Cesium.Color.RED.withAlpha(0.1),   // fill rất trong (~6% opacity)
      outline: true,
      outlineColor: Cesium.Color.RED.withAlpha(0.1), 
      outlineWidth: 2  // viền dày hơn chút
    }
  });
})
})

// Hàm tính góc tâm footprint beam (acos form, ổn định)
function beamCentralAngle(altKm, beamHalfDeg) {
  const R = R_E;      // đơn vị: same unit as altKm (km)
  const h = altKm;
  const theta = Cesium.Math.toRadians(beamHalfDeg);
  let cosPsi = (R / (R + h)) * Math.cos(theta);
  cosPsi = Math.min(1, Math.max(-1, cosPsi));
  return Math.acos(cosPsi); // rad
}

// DEBUG flag: bật để in log (set false sau khi debug xong)
const DEBUG_CONNECTION = true;

// onTick: compute connections for each groundStation and draw link
viewer.clock.onTick.addEventListener(function (clock) {
  polylineCollection.removeAll();
  const time = clock.currentTime;

  if (!groundStations) return;
        // 👇 reset HUD mỗi tick
        if (hudConnection) {
          hudConnection.textContent = "";
        }

  for (let j = 0; j < groundStations.length; j++) {
    const gs = groundStations[j];
    let isActive = false;

    // normalized vector from Earth center to gateway
    const gsNorm = Cesium.Cartesian3.normalize(gs.ecf, new Cesium.Cartesian3());

    for (const sat of sats) {
      const ecefSat = sat.position ? sat.position.getValue(time) : null;
      if (!ecefSat) continue;

      // get satellite cartographic (lon, lat, height)
      const carto = ellipsoid.cartesianToCartographic(ecefSat);
      const altKm = carto.height / 1000.0;

        // ---- Condition 1: LOS (elevation) ----
        const elevation = calculateElevationAngle(gs.ecf, ecefSat);
        if (elevation <= elevMinDeg) continue;


      // ---- Condition 2: gateway inside sat beam footprint ----
      // compute sub-satellite point (project sat down to surface)
      const subCarto = Cesium.Cartographic.fromRadians(carto.longitude, carto.latitude, 0.0);
      const subSat = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0.0, ellipsoid);

      // normalize subSat vector (OG -> sub-sat)
      const subNorm = Cesium.Cartesian3.normalize(subSat, new Cesium.Cartesian3());

      // central angle between GS and sub-sat (rad)
      const dCentral = Cesium.Cartesian3.angleBetween(gsNorm, subNorm);
      const dCentralDeg = Cesium.Math.toDegrees(dCentral);

      // beam central angle allowed (rad)
      const beamHalf = sat.beamHalfDeg || defaultSatBeamHalfDeg;
      const psiMaxBeam = beamCentralAngle(altKm, beamHalf);
      const psiMaxBeamDeg = Cesium.Math.toDegrees(psiMaxBeam);

      if (dCentral >= psiMaxBeam) continue;
      
      isActive = true;
      polylineCollection.add({
        positions: [ecefSat, gs.ecf],
        width: 2,
        material: Cesium.Material.fromType("Color", { color: Cesium.Color.RED.withAlpha(0.75) }),
      });

      // ---- Tính azimuth từ GS đến vệ tinh ----
const gsToSat = Cesium.Cartesian3.subtract(ecefSat, gs.ecf, new Cesium.Cartesian3());
const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(gs.ecf, ellipsoid);
const inverseEnu = Cesium.Matrix4.inverse(enuTransform, new Cesium.Matrix4());
const enuVector = Cesium.Matrix4.multiplyByPointAsVector(inverseEnu, gsToSat, new Cesium.Cartesian3());
const azimuth = Math.atan2(enuVector.x, enuVector.y) * 180 / Math.PI; // deg


const direction = azimuthToDirection(azimuth);
function azimuthToDirection(azimuth) {
  // az: độ, có thể âm
  // chuẩn hóa trong -180 → 180
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  // chia 360° thành 8 hướng, mỗi hướng 45°
  let angle = azimuth;
  // không cần +360, giữ âm
  angle += 22.5; // offset để chia 8 hướng
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;

  // map sang 0-7
  const idx = Math.floor(((angle + 180) % 360) / 45) % 8;
  return dirs[idx];
}


// 👇 cập nhật HUD
if (hudConnection) {
  hudConnection.textContent +=
    `GS: ${gs.name}\n` +
    `Sat: ${sat.name || sat.id}\n` +
    `Elevation: ${elevation.toFixed(2)}° (min ${elevMinDeg}°)\n` +
    `Azimuth: ${azimuth.toFixed(1)}°${azimuthToDirection(azimuth)}\n`+
    `Central angle: ${dCentralDeg.toFixed(2)}° / ${psiMaxBeamDeg.toFixed(2)}°\n\n`;
}
}
    // update marker color/size
    if (gs.entity && gs.entity.point) {
      gs.entity.point.color = isActive ? Cesium.Color.RED : Cesium.Color.AQUA;
      gs.entity.point.pixelSize = isActive ? 14 : 10;
    }

    // update footprint visual (optional)
    if (gs.coverageEntity && gs.coverageEntity.polygon) {
      gs.coverageEntity.polygon.material = isActive
        ? Cesium.Color.YELLOW.withAlpha(0.3)
        : Cesium.Color.LIME.withAlpha(0.22);
    }
    }
});
}  
