// satellite-hover.js
import { createGroundStations } from './groundstation.js';
import { getSatelliteLookAtGS } from './satellite-look.js';


const GRAVITATIONAL_EARTH_PARAMETER = 398600.4418; // km^3/s^2

// Hàm tính chu kỳ quỹ đạo (để vẽ quỹ đạo cho hợp lý)
function getOrbitalPeriod(position, velocity) {
    const positionMagnitude = Math.sqrt(Math.pow(position.x, 2) + Math.pow(position.y, 2) + Math.pow(position.z, 2));
    const velocityMagnitude = Math.sqrt(Math.pow(velocity.x, 2) + Math.pow(velocity.y, 2) + Math.pow(velocity.z, 2));
    const semiMajorAxis = 1 / ((2 / positionMagnitude) - (Math.pow(velocityMagnitude, 2) / GRAVITATIONAL_EARTH_PARAMETER));
    const orbitalPeriodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / GRAVITATIONAL_EARTH_PARAMETER);
    return orbitalPeriodSeconds / 60; // Trả về phút
}
// Hàm tạo một thực thể vệ tinh
function createSatelliteEntity(viewer, name, tleLine1, tleLine2) {
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const pv = satellite.propagate(satrec, new Date());
    const orbitalPeriod = getOrbitalPeriod(pv.position, pv.velocity);

    const satelliteEntity = viewer.entities.add({
        id: name,
        position: new Cesium.CallbackProperty(function(time, result) {
            if (!time) return;
            const jsDate = Cesium.JulianDate.toDate(time);
            const pv = satellite.propagate(satrec, jsDate);
            const eci = pv.position;
            if (eci) {
                const gmst = satellite.gstime(jsDate);
                const gd = satellite.eciToGeodetic(eci, gmst);
                const lon = Cesium.Math.toDegrees(gd.longitude);
                const lat = Cesium.Math.toDegrees(gd.latitude);
                const alt = gd.height * 1000;
                return Cesium.Cartesian3.fromDegrees(lon, lat, alt, Cesium.Ellipsoid.WGS84, result);
            }
        }, false),
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
        interpolationDegree: 5,
        point: { 
            pixelSize: 6, 
            color: Cesium.Color.DARKGOLDENROD
        },
        label: {
            text: name,
            font: '12pt monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            show: false
        }
    });

    satelliteEntity.satrec = satrec;
    satelliteEntity.orbitalPeriod = orbitalPeriod;
    return satelliteEntity;
}

// Hàm bật/tắt quỹ đạo
function toggleSatelliteOrbit(viewer, satelliteEntity) {
    const orbitId = satelliteEntity.id + '-orbit';
    const existingOrbit = viewer.entities.getById(orbitId);

    if (existingOrbit) {
        viewer.entities.remove(existingOrbit);
        return;
    }

    const orbitEntity = viewer.entities.add({
        id: orbitId,
        polyline: {
           // SỬ DỤNG LẠI CALLBACKPROPERTY ĐỂ TÍNH TOÁN LẠI QUỸ ĐẠO MỖI FRAME
            positions: new Cesium.CallbackProperty(function(time, result) {
                const positions = [];
                const satrec = satelliteEntity.satrec;
                const orbitalPeriod = satelliteEntity.orbitalPeriod;
                const pointsCount = 24;
                const step = orbitalPeriod / pointsCount;
                
                // BƯỚC 1: Lấy gmst tại thời điểm hiện tại của khung hình
                const gmst = satellite.gstime(Cesium.JulianDate.toDate(time));

                // BƯỚC 2: Tính toán các điểm ECI cho một chu kỳ quỹ đạo đầy đủ
                for (let i = pointsCount; i >= 0; i--) { // Ở đây, chúng ta chạy i = pointsCount về 0 thay vì chạy theo chiều xuôi là vì, để phần dày nhất của đường đi quỹ đạo được bắt đầu từ vệ tinh
                    // Chúng ta sẽ tính quỹ đạo cho chu kỳ tiếp theo kể từ thời điểm "time"
                    const sampleTime = Cesium.JulianDate.addMinutes(time, i * step, new Cesium.JulianDate());
                    const jsDate = Cesium.JulianDate.toDate(sampleTime);
                    
                    const pv = satellite.propagate(satrec, jsDate);
                    const eci = pv.position;

                    if (eci) {
                        // BƯỚC 3: Chuyển đổi mỗi điểm ECI của quỹ đạo sang ECEF
                        // sử dụng CÙNG MỘT giá trị gmst của khung hình hiện tại.
                        // Điều này "đóng băng" quỹ đạo vào đúng vị trí quán tính của nó tại thời điểm đó.
                        const gd = satellite.eciToGeodetic(eci, gmst);
                        const cartesian = Cesium.Cartesian3.fromDegrees(
                            Cesium.Math.toDegrees(gd.longitude),
                            Cesium.Math.toDegrees(gd.latitude),
                            gd.height * 1000
                        );
                        positions.push(cartesian);
                    }
                }
                return positions;
            }, false),
            
            width: 10,

            material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.5,
                color: Cesium.Color.YELLOW.withAlpha(0.5),
                taperPower: 0.9
            })
        }
    });
}

// Hàm chính để khởi tạo các vệ tinh
export async function initializeSatellites(viewer) {
    const createdSats = [];
    try {
        const response = await fetch('satellites.tle');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const tleData = await response.text();
        const lines = tleData.trim().split(/\r?\n/);

        for (let i = 0; i < lines.length; i += 3) {
            const name = lines[i].trim();
            const tleLine1 = lines[i + 1].trim();
            const tleLine2 = lines[i + 2].trim();
            if (name && tleLine1 && tleLine2) {
                const sat = createSatelliteEntity(viewer, name, tleLine1, tleLine2);
                createdSats.push(sat);
            }
        }
        
        // Cấu hình đồng hồ
        const now = Cesium.JulianDate.fromDate(new Date());
        viewer.clock.startTime = now.clone();
        viewer.clock.currentTime = now.clone();
        viewer.clock.shouldAnimate = true;
        viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED; 
        viewer.timeline.zoomTo(viewer.clock.startTime, Cesium.JulianDate.addMinutes(viewer.clock.startTime, 90, new Cesium.JulianDate()));

    } catch (error) {
        console.error("Lỗi khi tải hoặc xử lý file Txt:", error);
    }
    
    // Thêm sự kiện click để bật/tắt quỹ đạo
    viewer.screenSpaceEventHandler.setInputAction(function (movement) {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            const entity = pickedObject.id;
            
            if (entity.satrec) { 
                toggleSatelliteOrbit(viewer, entity);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);


    return createdSats; // Trả về mảng các vệ tinh đã tạo
}

