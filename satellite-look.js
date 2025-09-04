import { createGroundStations } from './groundstation.js';

export function initGroundStations(viewer) {
    return createGroundStations(viewer, Cesium.Ellipsoid.WGS84, 6371);
}

export function deg2rad(deg) { return deg * Math.PI / 180; }
export function rad2deg(rad) { return rad * 180 / Math.PI; }

export function computeLookAngles(gs, satPosECEF) {
    const a = 6378.137;
    const f = 1 / 298.257223563;
    const e2 = 2*f - f*f;

    const latRad = deg2rad(gs.lat);
    const lonRad = deg2rad(gs.lon);
    const h = gs.alt || 0;

    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad)**2);

    const gsX = (N + h) * Math.cos(latRad) * Math.cos(lonRad);
    const gsY = (N + h) * Math.cos(latRad) * Math.sin(lonRad);
    const gsZ = (N*(1 - e2) + h) * Math.sin(latRad);

    const dx = satPosECEF.x - gsX;
    const dy = satPosECEF.y - gsY;
    const dz = satPosECEF.z - gsZ;

    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);

    const east  = -sinLon*dx + cosLon*dy;
    const north = -sinLat*cosLon*dx - sinLat*sinLon*dy + cosLat*dz;
    const up    = cosLat*cosLon*dx + cosLat*sinLon*dy + sinLat*dz;

    const az = Math.atan2(east, north);
    const el = Math.atan2(up, Math.sqrt(east*east + north*north));

    return {
        azimuth: (rad2deg(az) + 360) % 360,
        elevation: rad2deg(el)
    };
}

export function getSatelliteLookAtGS(satrec, gs) {
    const now = new Date();
    const pv = satellite.propagate(satrec, now);
    if (!pv.position) return null;
    return computeLookAngles(gs, {
        x: pv.position.x,
        y: pv.position.y,
        z: pv.position.z
    });
}

