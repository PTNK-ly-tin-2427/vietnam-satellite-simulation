import * as satellite from "https://esm.sh/satellite.js";

async function runSimulation() {
  // ▼▼▼▼▼ THAY THẾ TOKEN CỦA BẠN VÀO ĐÂY ▼▼▼▼▼
  Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3Yzg5M2JjZi1mOTY5LTQ4ODgtYjg2MS02NWYwYWI1YWJkNTEiLCJpZCI6MzMxNTI3LCJpYXQiOjE3NTUwNjgwNzF9.VlqKyM0AOqobv7jkWw3aB5GwptsqHs-bWFmS1KIQ4UU";
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  // ===== Cesium viewer =====
  const viewer = new Cesium.Viewer("cesiumContainer", {
    shouldAnimate: true,
    imageryProvider: new Cesium.IonImageryProvider({ assetId: 3954 }),
    baseLayerPicker: true,
    timeline: true,
    animation: true,
    terrainProvider: await Cesium.createWorldTerrainAsync(),
  });

  viewer.scene.debugShowFramesPerSecond = true;
  viewer.scene.globe.enableLighting = true;

  const ellipsoid = Cesium.Ellipsoid.WGS84;
  const R_E = ellipsoid.maximumRadius;

  // ===== Các hằng số và cấu hình (Giữ nguyên) =====
  const VN = { minLon: 102, maxLon: 110, minLat: 8, maxLat: 23 };
  const midLat = (VN.minLat + VN.maxLat) / 2;
  const groundStations = [
    { name: "Ha Noi", lon: 105.83, lat: 21.02 },
    { name: "Da Nang", lon: 108.22, lat: 16.06 },
    { name: "Ho Chi Minh", lon: 106.66, lat: 10.75 },
    { name: "Can Tho", lon: 105.78, lat: 10.04 },
    { name: "Singapore", lon: 103.85, lat: 1.35 },
    { name: "Tokyo", lon: 139.69, lat: 35.68 },
  ];
  // ... (Phần khởi tạo trạm mặt đất và ISS giữ nguyên)
  groundStations.forEach((s) => { s.ecf = Cesium.Cartesian3.fromDegrees(s.lon, s.lat); s.surf = ellipsoid.scaleToGeodeticSurface(s.ecf); s.entity = viewer.entities.add({ position: s.ecf, point: { pixelSize: 10, color: Cesium.Color.AQUA, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 }, label: { text: s.name, font: "12pt monospace", style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, 12), }, }); });
  const ISS = { tle1: "1 25544U 98067A   24227.56193912  .00016717  00000-0  30129-3 0  9995", tle2: "2 25544  51.6403 272.2530 0007219 130.4312 321.4938 15.49380015468249", }; const issRec = satellite.twoline2satrec(ISS.tle1, ISS.tle2); function issEcef(time) { const d = Cesium.JulianDate.toDate(time); const pv = satellite.propagate(issRec, d); if (!pv || !pv.position) return null; const gmst = satellite.gstime(d); const ecf = satellite.eciToEcf(pv.position, gmst); return new Cesium.Cartesian3(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000); } viewer.entities.add({ name: "ISS", position: new Cesium.CallbackProperty(issEcef, false), point: { pixelSize: 10, color: Cesium.Color.YELLOW } });
  
  // ... (Phần khởi tạo chòm sao Walker giữ nguyên)
  const BEAM_RADIUS_KM_HINT = 240; const widthKm = (VN.maxLon - VN.minLon) * 111 * Math.cos(Cesium.Math.toRadians(midLat)); const heightKm = (VN.maxLat - VN.minLat) * 111; const Nlon = Math.max(3, Math.ceil(widthKm / (Math.sqrt(3) * BEAM_RADIUS_KM_HINT))); const Nlat = Math.max(2, Math.ceil(heightKm / (1.5 * BEAM_RADIUS_KM_HINT))); const PLANES = Nlon; const SATS_PER_PLANE = Math.max(3, 2 * Nlat); const MAX_SATS = 60; const TOTAL = Math.min(MAX_SATS, PLANES * SATS_PER_PLANE); let altKm = 550; const mu = 398600.4418; const inc = Cesium.Math.toRadians(53); const walkerDelta = 1; function meanMotion(alt_km) { const R = 6371 + alt_km; return Math.sqrt(mu / Math.pow(R, 3)); } function walkerEcef(time, plane, index, P, S, delta = 1, alt_km = 550) { const n = meanMotion(alt_km); const t = Cesium.JulianDate.toDate(time).getTime() / 1000; const R = 6371 + alt_km; const raan = (2 * Math.PI * plane) / P; const M0 = (2 * Math.PI * (index + delta * plane)) / S; const u = M0 + n * t; const x_op = R * Math.cos(u), y_op = R * Math.sin(u); const cosO = Math.cos(raan), sinO = Math.sin(raan); const cosi = Math.cos(inc), sini = Math.sin(inc); const x1 = x_op, y1 = y_op * cosi, z1 = y_op * sini; const x = cosO * x1 - sinO * y1; const y = sinO * x1 + cosO * y1; const z = z1; const m = Cesium.Transforms.computeIcrfToFixedMatrix(time); if (!m) return null; const eci = new Cesium.Cartesian3(x * 1000, y * 1000, z * 1000); return Cesium.Matrix3.multiplyByVector(m, eci, new Cesium.Cartesian3()); }
  
  // ===== Các hàm tính toán (Giữ nguyên) =====
  let showFootprints = true; let elevMinDeg = 40;
  function psiRad(alt_km, elev_deg) { const h = alt_km * 1000.0; const e = Cesium.Math.toRadians(elev_deg); const term = (R_E / (R_E + h)) * Math.cos(e); const clamped = Math.max(-1, Math.min(1, term)); const psi = Math.acos(clamped) - e; return Math.max(0, psi); }
  function footprintRadiusMeters(alt_km, elev_deg) { return psiRad(alt_km, elev_deg) * R_E; }
  
  // ===== Tạo vệ tinh (Giữ nguyên) =====
  const sats = []; let count = 0; for (let p = 0; p < PLANES && count < TOTAL; p++) { for (let s = 0; s < SATS_PER_PLANE && count < TOTAL; s++) { const satEntity = viewer.entities.add({ name: `LEO-${p + 1}-${s + 1}`, position: new Cesium.CallbackProperty((t) => walkerEcef(t, p, s, PLANES, SATS_PER_PLANE, walkerDelta, altKm), false), point: { pixelSize: 6, color: Cesium.Color.YELLOW.withAlpha(0.95) }, ellipse: { show: new Cesium.CallbackProperty(() => showFootprints, false), semiMajorAxis: new Cesium.CallbackProperty(() => footprintRadiusMeters(altKm, elevMinDeg), false), semiMinorAxis: new Cesium.CallbackProperty(() => footprintRadiusMeters(altKm, elevMinDeg), false), height: 0, material: Cesium.Color.fromBytes(0, 160, 255, 60), outline: true, outlineColor: Cesium.Color.fromBytes(180, 220, 255, 180), outlineWidth: 1.0, }, }); sats.push({ entity: satEntity, plane: p, index: s }); count++; } }

  // ===== Giao diện (Giữ nguyên) =====
  const polylineCollection = new Cesium.PolylineCollection(); viewer.scene.primitives.add(polylineCollection);
  const hud = document.getElementById("hud"); const elevSlider = document.getElementById("elevSlider"); const elevVal = document.getElementById("elevVal"); const altVal = document.getElementById("altVal"); const toggleFoot = document.getElementById("toggleFoot");
  function refreshHUD() { const psiDeg = Cesium.Math.toDegrees(psiRad(altKm, elevMinDeg)); const Rm = footprintRadiusMeters(altKm, elevMinDeg); const area = (Math.PI * Rm * Rm) / 1e6; hud.textContent = `VN box: lon ${VN.minLon}..${VN.maxLon}, lat ${VN.minLat}..${VN.maxLat}\nShell altitude h: ${altKm} km\nMin elevation ε: ${elevMinDeg}°\nFootprint half-angle ψ: ${psiDeg.toFixed(2)}°\nFootprint arc radius ≈ ${(Rm / 1000).toFixed(0)} km\nFootprint area ~ ${area.toFixed(0)} km²\nEstimated planes = ${PLANES}, sats/plane ≈ ${SATS_PER_PLANE}, total = ${count}\nNOTE: Connects to the satellite with the highest elevation angle only.`;}
  toggleFoot.addEventListener("change", (e) => { showFootprints = e.target.checked; refreshHUD(); }); elevSlider.addEventListener("input", (e) => { elevMinDeg = parseInt(e.target.value, 10); elevVal.textContent = `${elevMinDeg}°`; refreshHUD(); });
  refreshHUD();

  // ★★★ TỐI ƯU HÓA: Tạo các đối tượng tính toán MỘT LẦN duy nhất bên ngoài vòng lặp ★★★
  const scratchEnuTransform = new Cesium.Matrix4();
  const scratchInverseEnu = new Cesium.Matrix4();
  const scratchStationToSatVec = new Cesium.Cartesian3();
  const scratchEnuVector = new Cesium.Cartesian3();
  const scratchSurfaceA = new Cesium.Cartesian3();
  const scratchSurfaceB = new Cesium.Cartesian3();

  // Hàm tính góc ngẩng đã được tối ưu
  function calculateElevationAngle(stationEcf, satelliteEcf) {
    const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(stationEcf, ellipsoid, scratchEnuTransform);
    const stationToSatVector = Cesium.Cartesian3.subtract(satelliteEcf, stationEcf, scratchStationToSatVec);
    const inverseEnu = Cesium.Matrix4.inverse(enuTransform, scratchInverseEnu);
    const enuVector = Cesium.Matrix4.multiplyByPointAsVector(inverseEnu, stationToSatVector, scratchEnuVector);
    Cesium.Cartesian3.normalize(enuVector, enuVector);
    return Cesium.Math.toDegrees(Math.asin(enuVector.z));
  }

  // Hàm tính góc ở tâm đã được tối ưu
  function centralAngleBetween(surfaceA, surfaceB) {
    const a = Cesium.Cartesian3.normalize(surfaceA, scratchSurfaceA);
    const b = Cesium.Cartesian3.normalize(surfaceB, scratchSurfaceB);
    const dot = Cesium.Cartesian3.dot(a, b);
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  // ★★★ VÒNG LẶP `onTick` SIÊU TỐI ƯU ★★★
  viewer.clock.onTick.addEventListener(function (clock) {
    polylineCollection.removeAll();
    const time = viewer.clock.currentTime;
    const psi = psiRad(altKm, elevMinDeg);

    // Giai đoạn 1: Tìm vệ tinh tốt nhất cho mỗi trạm (không thay đổi logic)
    const stationBestConnections = groundStations.map(() => ({
      bestSatEcef: null,
      maxElevation: -90,
    }));

    for (const sat of sats) {
      const ecefSat = sat.entity.position.getValue(time);
      if (!ecefSat) continue;

      const sub = ellipsoid.scaleToGeodeticSurface(ecefSat);
      if (!sub) continue;

      for (let j = 0; j < groundStations.length; j++) {
        const gs = groundStations[j];
        // Sử dụng hàm đã tối ưu, không tạo đối tượng mới
        const ang = centralAngleBetween(sub, gs.surf); 
        
        if (ang <= psi) {
          // Sử dụng hàm đã tối ưu, không tạo đối tượng mới
          const elevation = calculateElevationAngle(gs.ecf, ecefSat); 
          if (elevation > stationBestConnections[j].maxElevation) {
            stationBestConnections[j].maxElevation = elevation;
            // Lưu trữ vị trí ECEF của vệ tinh tốt nhất
            stationBestConnections[j].bestSatEcef = Cesium.Cartesian3.clone(ecefSat);
          }
        }
      }
    }

    // Giai đoạn 2: Cập nhật giao diện (không thay đổi logic)
    for (let j = 0; j < groundStations.length; j++) {
      const gs = groundStations[j];
      const bestConnection = stationBestConnections[j];
      const isActive = bestConnection.bestSatEcef !== null;

      if (gs.entity.point) {
        gs.entity.point.color = isActive ? Cesium.Color.RED : Cesium.Color.AQUA;
        gs.entity.point.pixelSize = isActive ? 14 : 10;
      }
      
      if (isActive) {
        polylineCollection.add({
          positions: [bestConnection.bestSatEcef, gs.ecf],
          width: 2,
          material: Cesium.Material.fromType("Color", {
            color: Cesium.Color.RED.withAlpha(0.75),
          }),
        });
      }
    }
  });

  // Camera view (Giữ nguyên)
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(108, 16, 1.5e7),
    duration: 2.8,
  });
}

runSimulation();