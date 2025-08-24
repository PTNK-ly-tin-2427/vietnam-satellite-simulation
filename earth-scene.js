import * as THREE from 'three';

// --- Constants ---
const EARTH_R = 5;
const PROVINCES_LOCAL = 'VNM_1.geojson';
const DAY_TEX_PATH = 'light.jpg';

const CITY_SHOW_DISTANCE = EARTH_R + 1.0;
const PROVINCE_SHOW_DISTANCE = EARTH_R + 1.0;
const COUNTRY_LABEL_HIDE_DISTANCE = EARTH_R + 5.0;

export class EarthScene {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.texLoader = new THREE.TextureLoader();

        this.earth = null;
        this.provincesGroup = new THREE.Group();
        this.markers = [];
        this.provinceLabels = [];
        this.countryLabel = null;
    }

    async init() {
        const dayTex = await this.loadTexture(DAY_TEX_PATH);

        // Earth mesh
        const earthMat = this.makeDayNightMaterial(dayTex);
        this.earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 128), earthMat);
        this.scene.add(this.earth);

        // Atmosphere
        const atm = new THREE.Mesh(
            new THREE.SphereGeometry(EARTH_R * 1.02, 64, 64),
            new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.04, side: THREE.BackSide })
        );
        this.scene.add(atm);

        // Load features
        await this.loadProvinces(PROVINCES_LOCAL);

        // Add markers
        [
            { name: 'Hà Nội', lat: 21.0285, lon: 105.8544 },
            { name: 'TP.HCM', lat: 10.7769, lon: 106.7009 },
            { name: 'Đà Nẵng', lat: 16.0471, lon: 108.2022 },
            { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881 },
            { name: 'Cần Thơ', lat: 10.0452, lon: 105.7689 },
            { name: 'Huế', lat: 16.4637, lon: 107.58 },
            { name: 'Quần Đảo Hoàng Sa', lat: 16.5, lon: 111.5, type: 'island' },
            { name: 'Quần Đảo Trường Sa', lat: 8.6, lon: 114.3, type: 'island' },
        ].forEach(c => this.addMarker(c.name, c.lat, c.lon, c.type || 'city'));

        // Add country label
        this.addCountryLabel('VIỆT NAM', 15.5, 108);
        
        return this.earth; // Return the earth mesh for other modules to use
    }

    update(cameraDistance) {
        // Update markers/labels visibility and position
        for (const m of this.markers) {
            const worldPos = new THREE.Vector3();
            m.mesh.getWorldPosition(worldPos);
            const scr = this.projectToScreen(worldPos);
            const visible = cameraDistance < CITY_SHOW_DISTANCE && scr.z < 1;
            m.div.style.display = visible ? 'block' : 'none';
            if (visible) {
                m.div.style.left = `${scr.x}px`;
                m.div.style.top = `${scr.y}px`;
            }
        }

        const showProv = cameraDistance < PROVINCE_SHOW_DISTANCE;
        for (const pl of this.provinceLabels) {
            const worldPos = pl.pos.clone().applyMatrix4(this.earth.matrixWorld);
            const scr = this.projectToScreen(worldPos);
            const vis = showProv && scr.z < 1;
            pl.div.style.display = vis ? 'block' : 'none';
            if (vis) {
                pl.div.style.left = `${scr.x}px`;
                pl.div.style.top = `${scr.y}px`;
            }
        }

        if (this.countryLabel) {
            const worldPos = this.countryLabel.pos.clone().applyMatrix4(this.earth.matrixWorld);
            const scr = this.projectToScreen(worldPos);
            const anyProvVisible = showProv;
            const anyMarkerVisible = cameraDistance < CITY_SHOW_DISTANCE;
            const showCountry = !anyProvVisible && !anyMarkerVisible && cameraDistance >= COUNTRY_LABEL_HIDE_DISTANCE && scr.z < 1;
            this.countryLabel.div.style.display = showCountry ? 'block' : 'none';
            if (showCountry) {
                this.countryLabel.div.style.left = `${scr.x}px`;
                this.countryLabel.div.style.top = `${scr.y}px`;
            }
        }
    }
    
    updateSunDirection(sunDir) {
        if (this.earth && this.earth.material.uniforms) {
            this.earth.material.uniforms.sunDir.value.copy(sunDir).normalize();
        }
    }

    loadTexture(path) {
        return new Promise((res, rej) => this.texLoader.load(path, t => res(t), undefined, rej));
    }

    makeDayNightMaterial(dayMap) {
        const uniforms = {
            dayTex: { value: dayMap },
            sunDir: { value: new THREE.Vector3(1, 0, 0).normalize() },
            nightIntensity: { value: 0.25 }
        };
        return new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vWorldNormal;
                void main(){
                  vUv = uv;
                  vWorldNormal = normalize(normalMatrix * normal);
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                varying vec3 vWorldNormal;
                uniform sampler2D dayTex;
                uniform vec3 sunDir;
                uniform float nightIntensity;
                void main(){
                  vec3 N = normalize(vWorldNormal);
                  float ndotl = max(dot(N, normalize(sunDir)), 0.0);
                  vec3 dayCol = texture2D(dayTex, vUv).rgb;
                  vec3 color = dayCol * (nightIntensity + (1.0 - nightIntensity) * ndotl);
                  gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.FrontSide
        });
    }

    async loadProvinces(localName) {
        let gj = null;
        try {
            const r = await fetch(localName);
            if (r.ok) gj = await r.json();
        } catch (e) { console.warn('fetch provinces failed', e); return; }
        if (!gj) return;
        
        this.provincesGroup.clear();
        this.provinceLabels.forEach(p => p.div.remove());
        this.provinceLabels = [];

        const lineMat = new THREE.LineBasicMaterial({ color: 0x69c3ff, linewidth: 1, opacity: 0.9 });
        (gj.features || []).forEach(f => {
            const geom = f.geometry; if (!geom) return;
            const name = f.properties?.ten_tinh || f.properties?.name || '—';
            if (geom.type === 'Polygon') {
                geom.coordinates.forEach(ring => this.ringToLines(ring, lineMat));
                const c = this.centroidOfPolygon(geom.coordinates);
                if (c) this.addProvinceLabel(name, c[1], c[0]);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach(poly => poly.forEach(ring => this.ringToLines(ring, lineMat)));
                const c = this.centroidOfMultiPolygon(geom.coordinates);
                if (c) this.addProvinceLabel(name, c[1], c[0]);
            }
        });
        this.earth.add(this.provincesGroup);
    }

    ringToLines(ring, material) {
        const pts = ring.map(([lon, lat]) => this.latLonToVec3(lat, lon, EARTH_R + 0.03));
        if (pts.length && !pts[0].equals(pts[pts.length - 1])) pts.push(pts[0].clone());
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geom, material);
        this.provincesGroup.add(line);
    }

    addProvinceLabel(name, lat, lon) {
        const div = document.createElement('div');
        div.className = 'label province';
        div.textContent = name;
        div.style.display = 'none';
        document.body.appendChild(div);
        const pos = this.latLonToVec3(lat, lon, EARTH_R + 0.04);
        this.provinceLabels.push({ name, pos, div });
    }

    addMarker(name, lat, lon, type = 'city') {
        const pos = this.latLonToVec3(lat, lon, EARTH_R + 0.02);
        const mat = new THREE.MeshBasicMaterial({ color: type === 'island' ? 0xffcc00 : 0x2ea0ff });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mat);
        mesh.position.copy(pos);
        this.earth.add(mesh);
        const div = document.createElement('div');
        div.className = 'label' + (type === 'island' ? ' island' : '');
        div.textContent = name;
        div.style.display = 'none';
        document.body.appendChild(div);
        this.markers.push({ name, lat, lon, mesh, div, type });
    }

    addCountryLabel(text, lat, lon) {
        const div = document.createElement('div');
        div.className = 'label country';
        div.textContent = text;
        div.style.display = 'none';
        document.body.appendChild(div);
        const pos = this.latLonToVec3(lat, lon, EARTH_R + 0.05);
        this.countryLabel = { div, pos };
    }

    // --- Math helpers ---
    latLonToVec3(lat, lon, r = EARTH_R) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lon + 180) * Math.PI / 180;
        return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }

    projectToScreen(v3World) {
        const p = v3World.clone().project(this.camera);
        return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, z: p.z };
    }

    centroidOfPolygon(pol) {
        const ring = pol?.[0]; if (!ring) return null;
        let sx = 0, sy = 0, n = 0; ring.forEach(([x, y]) => { sx += x; sy += y; n++; });
        if (!n) return null; return [sx / n, sy / n];
    }

    centroidOfMultiPolygon(mpol) {
        let sx = 0, sy = 0, n = 0;
        mpol.forEach(pol => { const c = this.centroidOfPolygon(pol); if (c) { sx += c[0]; sy += c[1]; n++; } });
        if (!n) return null; return [sx / n, sy / n];
    }
}