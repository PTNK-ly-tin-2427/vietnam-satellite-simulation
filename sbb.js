function footprintRadiusMeters(R_E, alt_km, elev_deg) {
  const h = alt_km * 1000.0;
  const e = Cesium.Math.toRadians(elev_deg);
  const term = (R_E / (R_E + h)) * Math.cos(e);
  if (term > 1 || term < -1) return 0;
  return (Math.acos(term) - e) * R_E;
}

function beamFootprintRadiusMeters(R_E, alt_km, beamHalfDeg) {
  const alpha = Cesium.Math.toRadians(beamHalfDeg);
  const r_s = R_E + alt_km * 1000.0;
  const ratio = (r_s / R_E) * Math.sin(alpha);
  if (ratio >= 1) return Math.PI/2 * R_E;
  return Math.asin(ratio) * R_E;
}

export async function initializeSatellitesFootprint(viewer, ellipsoid, R_E, sats, groundStations) {
  let showFootprints = true;
  let showBeamFootprint = true;
  let elevMinDeg = 25;
  const satFootprints = [];

  // ==== CONFIG ====
  const defaultSatBeamHalfDeg = 1.5;  // half-angle mỗi spot beam
  const showElMinFootprint = true;

  // UI elements
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
      `Các trạm mặt đất: ${groundStations ? groundStations.length : 0}\n`;
  }
    
  // wire UI
  if (toggleFoot) {
    toggleFoot.addEventListener("change", (e) => {
      showFootprints = !!e.target.checked;
    });
  }

  refreshHUD();

  // === MATH: footprint ===


 function beamCentralAngle(altKm, beamHalfDeg) {
    const R = R_E;
    const h = altKm;
    const theta = Cesium.Math.toRadians(beamHalfDeg);
    let cosPsi = (R / (R + h)) * Math.cos(theta);
    cosPsi = Math.min(1, Math.max(-1, cosPsi));
    return Math.acos(cosPsi); // rad
  }

  // === MATH: elevation ===
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

  // === HEX GRID GENERATOR ===
  function generateHexCenters(beamR, coverR) {
    const centers = [[0,0]]; // beam trung tâm
    const beamSpacing = 1.5 * beamR;
    const maxRing = Math.ceil(coverR / beamSpacing);

    for (let ring = 1; ring <= maxRing; ring++) {
        const numBeams = 6 * ring;
        for (let i = 0; i < numBeams; i++) {
            const angle = (2 * Math.PI / numBeams) * i;
            const r = ring * beamSpacing;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (Math.sqrt(x*x + y*y) <= coverR) centers.push([x,y]);
        }
    }
    return centers;
}


  // === CREATE ENTITIES ===
  sats.forEach(satEntity => {
    // Marker dưới mặt đất
    if (!satEntity.subMarker) {
      satEntity.subMarker = viewer.entities.add({
        position: new Cesium.CallbackProperty(time => {
          const pos = satEntity.position?.getValue(time);
          if (!pos) return null;
          const carto = ellipsoid.cartesianToCartographic(pos);
          return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0.0, ellipsoid);
        }, false),
        point: {
          pixelSize: 4,
          color: Cesium.Color.YELLOW.withAlpha(0.5),
          outlineWidth: 0
        },
        label: {
          font: "12px sans-serif",
          fillColor: Cesium.Color.WHITE.withAlpha(0.6),
          style: Cesium.LabelStyle.FILL,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -6)
        }
      });
    }

    // Ellipse footprint el_min
    viewer.entities.add({
      position: new Cesium.CallbackProperty(time =>
        satEntity.position ? satEntity.position.getValue(time) : null, false),
      ellipse: {
        show: new Cesium.CallbackProperty(() => showElMinFootprint && showFootprints, false),
        semiMajorAxis: new Cesium.CallbackProperty(time => {
          const pos = satEntity.position?.getValue(time);
          if (!pos) return 0;
          const carto = ellipsoid.cartesianToCartographic(pos);
          return footprintRadiusMeters(R_E,carto.height/1000.0, elevMinDeg);
        }, false),
        semiMinorAxis: new Cesium.CallbackProperty(time => {
          const pos = satEntity.position?.getValue(time);
          if (!pos) return 0;
          const carto = ellipsoid.cartesianToCartographic(pos);
          return footprintRadiusMeters(R_E,carto.height/1000.0, elevMinDeg);
        }, false),
        height: 0,
        material: Cesium.Color.fromBytes(0,160,255,25),
        outline: true,
        outlineColor: Cesium.Color.fromBytes(180,220,255,180),
        outlineWidth: 2
      }
    });

 // --- tạo lưới beam hex cho mỗi vệ tinh ---
  const beamEntities = [];
  satEntity.beamEntities = beamEntities;

  const pos0 = satEntity.position?.getValue(viewer.clock.currentTime);
  if (!pos0) return;
  const carto0 = ellipsoid.cartesianToCartographic(pos0);
  const altKm = carto0.height / 1000;
  const visR = footprintRadiusMeters(R_E, altKm, elevMinDeg);   // LOS radius
  const beamHalfDeg = satEntity.beamHalfDeg || defaultSatBeamHalfDeg;
  const beamR = beamFootprintRadiusMeters(R_E, altKm, beamHalfDeg);

  // tạo lưới hex phẳng (tangent plane tại sub-sat)
  const centers = generateHexCenters(beamR, visR);

  centers.forEach(([x, y]) => {
    const beamEntity = viewer.entities.add({
      position: new Cesium.CallbackProperty(time => {
        const satPos = satEntity.position?.getValue(time);
        if (!satPos) return null;
  
        const carto = ellipsoid.cartesianToCartographic(satPos);
        const subSat = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0, ellipsoid);
  
        // ENU transform
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(subSat, ellipsoid);
        const local = new Cesium.Cartesian3(x, y, 0);
        const globalPos = Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3());
  
        const elev = calculateElevationAngle(globalPos, satPos); 
        if (elev < elevMinDeg) return null;
  
        return globalPos;
      }, false),
      ellipse: {
        semiMajorAxis: beamFootprintRadiusMeters(R_E, altKm, beamHalfDeg),
        semiMinorAxis: beamFootprintRadiusMeters(R_E, altKm, beamHalfDeg),
        height: 0,
        material: Cesium.Color.RED.withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.RED.withAlpha(0.3),
        outlineWidth: 1.5,
        show: new Cesium.CallbackProperty(() => showBeamFootprint && showFootprints, false)
      }
    });
    beamEntities.push(beamEntity);
  });
})
  
// kiểm tra elevation từ sub-sat

  // === CONNECTION CHECK ===
  const DEBUG_CONNECTION = true;

  viewer.clock.onTick.addEventListener(function (clock) {
    polylineCollection.removeAll();
    const time = clock.currentTime;

    if (!groundStations) return;

    if (hudConnection) hudConnection.textContent = "";

    for (let j = 0; j < groundStations.length; j++) {
      const gs = groundStations[j];
      let isActive = false;
      const gsNorm = Cesium.Cartesian3.normalize(gs.ecf, new Cesium.Cartesian3());

      for (const sat of sats) {
        const ecefSat = sat.position ? sat.position.getValue(time) : null;
        if (!ecefSat) continue;

        const carto = ellipsoid.cartesianToCartographic(ecefSat);
        const altKm = carto.height / 1000.0;

        // Condition 1: elevation
        const elevation = calculateElevationAngle(gs.ecf, ecefSat);
        if (elevation <= elevMinDeg) continue;
            // ---- Condition 2: GS nằm trong ít nhất 1 spot beam ----
    let inBeam = false;
    if (sat.beamEntities) {
      for (const beamEnt of sat.beamEntities) {
        const beamPos = beamEnt.position.getValue(time);
        if (!beamPos) continue;

        const diff = Cesium.Cartesian3.subtract(gs.ecf, beamPos, new Cesium.Cartesian3());
        const dist = Cesium.Cartesian3.magnitude(diff); // khoảng cách (m)
        if (dist <= beamFootprintRadiusMeters(R_E, altKm, sat.beamHalfDeg || defaultSatBeamHalfDeg)) {
          inBeam = true;
          break;
        }
      }
    }

    if (!inBeam) continue; // nếu GS không nằm trong bất kỳ beam nào → skip
        isActive = true;
        polylineCollection.add({
          positions: [ecefSat, gs.ecf],
          width: 2,
          material: Cesium.Material.fromType("Color", { color: Cesium.Color.RED.withAlpha(0.75) }),
        });

        // Azimuth
        const gsToSat = Cesium.Cartesian3.subtract(ecefSat, gs.ecf, new Cesium.Cartesian3());
        const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(gs.ecf, ellipsoid);
        const inverseEnu = Cesium.Matrix4.inverse(enuTransform, new Cesium.Matrix4());
        const enuVector = Cesium.Matrix4.multiplyByPointAsVector(inverseEnu, gsToSat, new Cesium.Cartesian3());
        const azimuth = Math.atan2(enuVector.x, enuVector.y) * 180 / Math.PI;

        const direction = azimuthToDirection(azimuth);

        if (hudConnection) {
          hudConnection.textContent +=
            `GS: ${gs.name}\n` +
            `Sat: ${sat.name || sat.id}\n` +
            `Elevation: ${elevation.toFixed(2)}° (min ${elevMinDeg}°)\n` +
            `Azimuth: ${azimuth.toFixed(1)}°${direction}\n` 
        }
      }

    // update GS marker
    if (gs.entity && gs.entity.point) {
      gs.entity.point.color = isActive ? Cesium.Color.RED : Cesium.Color.AQUA;
      gs.entity.point.pixelSize = isActive ? 14 : 10;
    }
      if (gs.coverageEntity && gs.coverageEntity.polygon) {
        gs.coverageEntity.polygon.material = isActive
          ? Cesium.Color.YELLOW.withAlpha(0.3)
          : Cesium.Color.LIME.withAlpha(0.22);
      }
    }
  });

  function azimuthToDirection(azimuth) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    let angle = azimuth + 22.5;
    if (angle > 180) angle -= 360;
    if (angle <= -180) angle += 360;
    const idx = Math.floor(((angle + 180) % 360) / 45) % 8;
    return dirs[idx];
  }
  // cuối hàm initializeSatellitesFootprint
// --- API object để toggle ---
return {
  satFootprints,
  setShowFootprints: v => showFootprints = v,
  setShowSpotBeams: v => showBeamFootprint = v,
  setElevMin: v => elevMinDeg = v,
  getShowFootprints: () => showFootprints,
  getShowSpotBeams: () => showBeamFootprint,
  getElevMin: () => elevMinDeg,
};
}
export function exportSimulationData(viewer, sats, ellipsoid, R_E, elevMinDeg = 25) {
  const data = sats.map(sat => {
    const pos = sat.position?.getValue(viewer.clock.currentTime);
    if (!pos) return null;

    const carto = ellipsoid.cartesianToCartographic(pos);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const altKm = carto.height / 1000.0;

    const visR = footprintRadiusMeters(R_E, altKm, elevMinDeg);

    // footprint polygon
    const footprintOutline = [];
    const N = 72;
    for (let i = 0; i < N; i++) {
      const az = (2 * Math.PI * i) / N;
      const d = visR;
      const local = new Cesium.Cartesian3(d * Math.cos(az), d * Math.sin(az), 0);
      const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(pos, ellipsoid);
      const global = Cesium.Matrix4.multiplyByPoint(enuTransform, local, new Cesium.Cartesian3());
      const c = ellipsoid.cartesianToCartographic(global);
      footprintOutline.push([Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)]);
    }

    // Spot beams
    const beams = (sat.beamEntities || []).map(b => {
      const center = b.position.getValue(viewer.clock.currentTime);
      if (!center) return null;
      const cc = ellipsoid.cartesianToCartographic(center);
      const beamLat = Cesium.Math.toDegrees(cc.latitude);
      const beamLon = Cesium.Math.toDegrees(cc.longitude);

      return {
        lat: beamLat,
        lon: beamLon,
        halfAngleDeg: sat.beamHalfDeg || 1.5,
        radiusMeters: beamFootprintRadiusMeters(R_E, altKm, sat.beamHalfDeg || 1.5)
      };
    }).filter(Boolean);

    return {
      satId: sat.id,
      position: { lat, lon, altKm },
      tle: sat.tle || null,
      los: { radiusMeters: visR, outline: footprintOutline },
      beams
    };
  }).filter(Boolean);

  console.log("=== EXPORT DATA ===");
  console.log(JSON.stringify(data));
  return data;
}
