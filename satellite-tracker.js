import * as THREE from 'three';

// A scaling factor to make satellite altitudes visually apparent.
// The raw altitude in km would be too small to see relative to the Earth radius unit.
const ALTITUDE_SCALE = 1 / 2000;
const EARTH_R = 5; // Must match the value in index.html

export class SatelliteTracker {
    constructor(scene, camera, earthGroup) {
        this.scene = scene;
        this.camera = camera;
        this.earthGroup = earthGroup; // Satellites will be children of this group
        this.satellites = [];
    }

    /**
     * Loads and processes a TLE file from a given URL.
     * @param {string} tleUrl - The URL of the .tle file.
     */
    async loadTLE(tleUrl) {
        try {
            const response = await fetch(tleUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const tleData = await response.text();
            const lines = tleData.trim().split(/\r?\n/);

            for (let i = 0; i < lines.length; i += 3) {
                const name = lines[i].trim();
                const tleLine1 = lines[i + 1].trim();
                const tleLine2 = lines[i + 2].trim();

                if (name && tleLine1 && tleLine2) {
                    this.createSatelliteEntity(name, tleLine1, tleLine2);
                }
            }
        } catch (error) {
            console.error("Error loading or processing TLE file:", error);
        }
    }

    /**
     * Creates a Three.js entity for a satellite.
     * @param {string} name - Satellite name.
     * @param {string} tleLine1 - First line of TLE data.
     * @param {string} tleLine2 - Second line of TLE data.
     */
    createSatelliteEntity(name, tleLine1, tleLine2) {
        const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

        const material = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        const geometry = new THREE.SphereGeometry(0.03, 8, 8);
        const mesh = new THREE.Mesh(geometry, material);

        const satelliteData = {
            name: name,
            satrec: satrec,
            mesh: mesh,
            orbitLine: null,
        };

        // Store user data for easy retrieval during raycasting
        mesh.userData.satellite = satelliteData;

        this.satellites.push(satelliteData);
        this.earthGroup.add(mesh); // Add satellite mesh to the earth group
    }

    /**
     * Updates the positions of all satellites based on the simulated time.
     * This should be called in the main animation loop.
     * @param {Date} simulatedDate - The current date/time from the simulation.
     */
    updatePositions(simulatedDate) {
        const gmst = satellite.gstime(simulatedDate);

        for (const sat of this.satellites) {
            const { position: eci } = satellite.propagate(sat.satrec, simulatedDate);

            if (eci) {
                const gd = satellite.eciToGeodetic(eci, gmst);
                const lat = satellite.degreesLat(gd.latitude);
                const lon = satellite.degreesLong(gd.longitude);
                // Adjust radius with scaled altitude
                const r = EARTH_R + gd.height * ALTITUDE_SCALE;

                const newPos = this.latLonToVec3(lat, lon, r);
                sat.mesh.position.copy(newPos);
            }
            
            // If orbit line exists, update it
            if(sat.orbitLine){
                this.updateOrbitLine(sat, simulatedDate);
            }
        }
    }
    
    /**
     * Toggles the visibility of a satellite's orbit.
     * @param {object} satelliteData - The satellite data object.
     */
    toggleOrbit(satelliteData) {
        if (satelliteData.orbitLine) {
            this.earthGroup.remove(satelliteData.orbitLine);
            satelliteData.orbitLine.geometry.dispose();
            satelliteData.orbitLine.material.dispose();
            satelliteData.orbitLine = null;
        } else {
            // Create and add the orbit line
            const material = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 });
            const geometry = new THREE.BufferGeometry();
            const line = new THREE.Line(geometry, material);
            
            satelliteData.orbitLine = line;
            this.earthGroup.add(line);
            
            // Calculate its points for the first time
            this.updateOrbitLine(satelliteData, new Date());
        }
    }
    
    /**
     * Updates the points of an existing orbit line.
     * @param {object} satelliteData - The satellite data object.
     * @param {Date} simulatedDate - The current simulation time.
     */
    updateOrbitLine(satelliteData, simulatedDate) {
        const points = this.calculateOrbitPoints(satelliteData, simulatedDate);
        satelliteData.orbitLine.geometry.setFromPoints(points);
        satelliteData.orbitLine.geometry.computeBoundingSphere(); // Important for visibility
    }

    /**
     * Calculates the points for an orbit path in the ECEF frame.
     * @param {object} satelliteData - The satellite data object.
     * @param {Date} centerTime - The time to center the orbit calculation around.
     * @returns {THREE.Vector3[]} - An array of points for the orbit line.
     */
    calculateOrbitPoints(satelliteData, centerTime) {
        const positions = [];
        const satrec = satelliteData.satrec;
        const orbitalPeriodMinutes = (2 * Math.PI) / satrec.no;
        const pointsCount = 24; // More points for a smoother curve
        const stepMinutes = orbitalPeriodMinutes / pointsCount;

        // Use the SAME gmst for all points in the orbit for a single frame.
        // This "freezes" the inertial orbit path relative to the rotating Earth.
        const gmst = satellite.gstime(centerTime);

        for (let i = 0; i <= pointsCount; i++) {
            const sampleJsDate = new Date(centerTime.getTime() + i * stepMinutes * 60000);
            const { position: eci } = satellite.propagate(satrec, sampleJsDate);

            if (eci) {
                const gd = satellite.eciToGeodetic(eci, gmst);
                const r = EARTH_R + gd.height * ALTITUDE_SCALE;
                const lat = satellite.degreesLat(gd.latitude);
                const lon = satellite.degreesLong(gd.longitude);
                positions.push(this.latLonToVec3(lat, lon, r));
            }
        }
        return positions;
    }

    /**
     * A helper to find a satellite by its mesh and toggle its orbit.
     * @param {THREE.Mesh} mesh - The intersected satellite mesh.
     */
    toggleOrbitByMesh(mesh) {
        const satelliteData = mesh.userData.satellite;
        if (satelliteData) {
            this.toggleOrbit(satelliteData);
        }
    }

    /**
     * Returns an array of satellite meshes for raycasting.
     * @returns {THREE.Mesh[]}
     */
    getSatelliteMeshes() {
        return this.satellites.map(s => s.mesh);
    }

    /**
     * Helper to convert Latitude/Longitude to a 3D vector.
     * Copied from index.html for self-containment.
     */
    latLonToVec3(lat, lon, r) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lon + 180) * Math.PI / 180;
        return new THREE.Vector3(
            -r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
    }
}