export async function initializeSatellitesFootprint(viewer, ellipsoid, R_E, sats) {
    // ===== Các trạm mặt đất =====
    const groundStations = [
        { name: "Ha Noi", lon: 105.83, lat: 21.02 },
        { name: "Da Nang", lon: 108.22, lat: 16.06 },
        { name: "Ho Chi Minh", lon: 106.66, lat: 10.75 },
        { name: "Can Tho", lon: 105.78, lat: 10.04 },
        { name: "Singapore", lon: 103.85, lat: 1.35 },
        { name: "Tokyo", lon: 139.69, lat: 35.68 }
    ];
    groundStations.forEach((s) => {
        s.ecf = Cesium.Cartesian3.fromDegrees(s.lon, s.lat);
        s.surf = ellipsoid.scaleToGeodeticSurface(s.ecf);
        s.entity = viewer.entities.add({
            position: s.ecf,
            point: { pixelSize: 10, color: Cesium.Color.AQUA, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
            label: { text: s.name, font: "12pt monospace", style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, 12) },
        });
    });

    // ===== Cấu hình và Giao diện =====
    let showFootprints = true;
    let elevMinDeg = 40;
    const hud = document.getElementById("hud");
    const elevSlider = document.getElementById("elevSlider");
    const elevVal = document.getElementById("elevVal");
    const toggleFoot = document.getElementById("toggleFoot");
    const polylineCollection = new Cesium.PolylineCollection();
    viewer.scene.primitives.add(polylineCollection);

    function refreshHUD() {
        hud.textContent = `Các vệ tinh đang được theo dõi: ${sats.length}\nCác trạm mặt đất: ${groundStations.length}\nGóc ngẩng tối thiểu (ε): ${elevMinDeg}°`;
    }
    toggleFoot.addEventListener("change", (e) => { showFootprints = e.target.checked; });
    elevSlider.addEventListener("input", (e) => {
        elevMinDeg = parseInt(e.target.value, 10);
        elevVal.textContent = `${elevMinDeg}°`;
        refreshHUD();
    });
    refreshHUD();

    // ===== Các hàm tính toán tối ưu =====
    function psiRad(alt_km, elev_deg) {
        const h = alt_km * 1000.0;
        const e = Cesium.Math.toRadians(elev_deg);
        const term = (R_E / (R_E + h)) * Math.cos(e);
        if (term > 1 || term < -1) return 0;
        const psi = Math.acos(term) - e;
        return Math.max(0, psi);
    }

    function footprintRadiusMeters(alt_km, elev_deg) {
        return psiRad(alt_km, elev_deg) * R_E;
    }

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
    
    // --- Thêm Footprint vào các vệ tinh đã tạo ---
    sats.forEach(satEntity => {
        satEntity.ellipse = {
            show: new Cesium.CallbackProperty(() => showFootprints, false),
            semiMajorAxis: new Cesium.CallbackProperty((time) => {
                const pos = satEntity.position.getValue(time);
                if (!pos) return 0;
                const carto = ellipsoid.cartesianToCartographic(pos);
                const currentAltKm = carto.height / 1000.0;
                return footprintRadiusMeters(currentAltKm, elevMinDeg);
            }, false),
            semiMinorAxis: new Cesium.CallbackProperty((time) => {
                 const pos = satEntity.position.getValue(time);
                if (!pos) return 0;
                const carto = ellipsoid.cartesianToCartographic(pos);
                const currentAltKm = carto.height / 1000.0;
                return footprintRadiusMeters(currentAltKm, elevMinDeg);
            }, false),
            height: 0,
            material: Cesium.Color.fromBytes(0, 160, 255, 60),
            outline: true,
            outlineColor: Cesium.Color.fromBytes(180, 220, 255, 180),
        };
    });

    // --- Vòng lặp cập nhật chính (onTick) ---
    viewer.clock.onTick.addEventListener(function (clock) {
        polylineCollection.removeAll();
        const time = clock.currentTime;

        const stationBestConnections = groundStations.map(() => ({
            bestSatEcef: null,
            maxElevation: -90,
        }));

        for (const sat of sats) {
            const ecefSat = sat.position.getValue(time);
            if (!ecefSat) continue;

            for (let j = 0; j < groundStations.length; j++) {
                const gs = groundStations[j];
                const elevation = calculateElevationAngle(gs.ecf, ecefSat);
                if (elevation >= elevMinDeg && elevation > stationBestConnections[j].maxElevation) {
                    stationBestConnections[j].maxElevation = elevation;
                    stationBestConnections[j].bestSatEcef = Cesium.Cartesian3.clone(ecefSat);
                }
            }
        }

        // Vẽ kết nối và cập nhật màu trạm
        for (let j = 0; j < groundStations.length; j++) {
            const gs = groundStations[j];
            const bestConnection = stationBestConnections[j];
            const isActive = bestConnection.bestSatEcef !== null;

            gs.entity.point.color = isActive ? Cesium.Color.RED : Cesium.Color.AQUA;
            gs.entity.point.pixelSize = isActive ? 14 : 10;
            
            if (isActive) {
                polylineCollection.add({
                    positions: [bestConnection.bestSatEcef, gs.ecf],
                    width: 2,
                    material: Cesium.Material.fromType("Color", { color: Cesium.Color.RED.withAlpha(0.75) }),
                });
            }
        }
    });
}
