export function initializeEarthViewer() {
    // --- Cấu hình Token và Viewer tối ưu ---
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxYTJmOTU0MS1iMGI5LTQyYmUtOGEyYy00N2RhMWM3ODQ0NzgiLCJpZCI6MzMxNjE1LCJpYXQiOjE3NTUwODMyNTJ9.GfJoFUD2JtuuK71LgrQQ8x7FCQ_fEtxQWxHaRQzuanE';
    
    const viewer = new Cesium.Viewer("cesiumContainer", {
      selectionIndicator: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: true,
      navigationHelpButton: false,
      animation: true, // Bật animation và timeline
      timeline: true,
      fullscreenButton: false,
      shadows: false,
      shouldAnimate: true,
      scene3DOnly: false,
    });

    viewer.scene.debugShowFramesPerSecond = true;
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    viewer.scene.globe.maximumScreenSpaceError = 8;
    viewer.scene.requestRenderMode = false;
    viewer.resolutionScale = 0.8;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.fog.enabled = false;

    // --- Nền toàn cầu low-res ---
    viewer.imageryLayers.addImageryProvider(
      new Cesium.SingleTileImageryProvider({
        url: "light.jpg", 
        rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90) // toàn cầu
      })
    );

    // --- Camera mặc định VN ---
    viewer.camera.setView({
      destination: Cesium.Rectangle.fromDegrees(102, 8, 114, 24),
    });

    // --- Vẽ biên giới và các địa danh Việt Nam ---
    drawVietnamFeatures(viewer);

    return { viewer, ellipsoid: Cesium.Ellipsoid.WGS84, R_E: Cesium.Ellipsoid.WGS84.maximumRadius };
}

function drawVietnamFeatures(viewer) {
    // Vẽ biên giới từ GeoJSON
    Cesium.GeoJsonDataSource.load("./VNM_1.geojson", {
      stroke: Cesium.Color.YELLOW,
      strokeWidth: 2,
      clampToGround: false,
    }).then((ds) => {
      viewer.dataSources.add(ds);
      ds.entities.values.forEach(entity => {
        if (entity.polygon) {
          entity.polygon.material = Cesium.Color.YELLOW.withAlpha(0.1);
          entity.polygon.outline = true;
          entity.polygon.outlineColor = Cesium.Color.ORANGE;
        }
      });
    });

    // Label VIỆT NAM
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(107, 16),
      label: {
        text: "VIỆT NAM",
        font: "bold 30px 'Times New Roman', serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      }
    });
  }
