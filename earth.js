Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxYTJmOTU0MS1iMGI5LTQyYmUtOGEyYy00N2RhMWM3ODQ0NzgiLCJpZCI6MzMxNjE1LCJpYXQiOjE3NTUwODMyNTJ9.GfJoFUD2JtuuK71LgrQQ8x7FCQ_fEtxQWxHaRQzuanE';
    // --- Viewer tối ưu ---
    const viewer = new Cesium.Viewer("cesiumContainer", {
      selectionIndicator: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: true,
      navigationHelpButton: false,
      animation: false,
      fullscreenButton: false,
      shadows: false,
      shouldAnimate: true,
      scene3DOnly: false,
    });

    // Hiện FPS
    viewer.scene.debugShowFramesPerSecond = true;

    // Terrain nhẹ
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    viewer.scene.globe.maximumScreenSpaceError = 8;

    // Render khi thay đổi

viewer.scene.requestRenderMode = false;

// Bật hiển thị FPS
viewer.scene.debugShowFramesPerSecond = true;

    // Giảm độ phân giải
    viewer.resolutionScale = 0.8;

    // Tắt hiệu ứng nặng
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.fog.enabled = false;

    // --- Nền toàn cầu low-res ---
    const lowResProvider = new Cesium.SingleTileImageryProvider({
      url: "light.jpg"
    });
    viewer.imageryLayers.addImageryProvider(lowResProvider);

    // --- Overlay VN chi tiết ---
    const vnProvider = new Cesium.UrlTemplateImageryProvider({
      url: "light.jpg",
      minimumLevel: 5,
      maximumLevel: 12,
    });
    const vnLayer = viewer.imageryLayers.addImageryProvider(vnProvider);
    vnLayer.show = false;

    // Camera mặc định VN
    viewer.camera.setView({
      destination: Cesium.Rectangle.fromDegrees(102, 8, 114, 24),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0,
      },
    });

Cesium.GeoJsonDataSource.load("./VNM_1.geojson", {
  stroke: Cesium.Color.YELLOW,
  strokeWidth: 2,
  clampToGround: false,
}).then((ds) => {
  viewer.dataSources.add(ds);

  ds.entities.values.forEach(entity => {
    if (entity.polygon) {
      // Style polygon
      entity.polygon.material = Cesium.Color.YELLOW.withAlpha(0.3);
      entity.polygon.outline = true;
      entity.polygon.outlineColor = Cesium.Color.ORANGE;

      // ---- Tính centroid ----
      const positions = entity.polygon.hierarchy.getValue().positions;
      let lon = 0, lat = 0;
      positions.forEach(pos => {
        const carto = Cesium.Cartographic.fromCartesian(pos);
        lon += Cesium.Math.toDegrees(carto.longitude);
        lat += Cesium.Math.toDegrees(carto.latitude);
      });
      lon /= positions.length;
      lat /= positions.length;

      // ---- Thêm label tỉnh ----
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        label: {
          text: entity.properties.name || entity.properties.ten_tinh || "???",
          font: 'bold 20px "Times New Roman", serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          show: false,
          scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 1500000, 0.0)
        }
      });
    }
  });

  // Label VIỆT NAM
  const vietnamLabel = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(107, 16),
    label: {
      text: "VIỆT NAM",
      font: "bold 30px 'Times New Roman', serif",
      fillColor: Cesium.Color.BLACK,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      heightReference: Cesium.HeightReference.NONE,
      show: true
    }
  });

  // Cập nhật hiển thị label theo zoom
  function updateLabels() {
    const cameraHeight = viewer.camera.positionCartographic.height;
    const showProvinceLabels = cameraHeight < 600000;
    const showVietnamLabel = cameraHeight >= 500000;

    viewer.entities.values.forEach(entity => {
      if (entity.label && entity.label.text.getValue() !== "VIỆT NAM") {
        entity.label.show = showProvinceLabels;
      }
      if (entity.polygon) {
        entity.polygon.material = showProvinceLabels
          ? Cesium.Color.TRANSPARENT
          : Cesium.Color.YELLOW.withAlpha(0.1);
      }
    });

    vietnamLabel.label.show = showVietnamLabel;
  }

  viewer.camera.changed.addEventListener(updateLabels);
  updateLabels();
}).catch(err => {
  console.error("❌ Lỗi tải GeoJSON:", err);
});


            const islands = [
            { name: "Quần Đảo Hoàng Sa", lon: 111.5, lat: 16.5 },
            { name: "Quần Đảo Trường Sa", lon: 114.3, lat: 8.6 }
        ];

        islands.forEach(island => {
            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(island.lon, island.lat),
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.YELLOW,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2
                },
                label: {
                    text: island.name,
                    font: "bold 28px 'Arial', serif",
                    fillColor: Cesium.Color.PINK,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10)
                }
            });
        });
        const majorCities = [
            { name: "Hà Nội", lon: 105.8544, lat: 21.0285 },
            { name: "TP.HCM", lon: 106.6297, lat: 10.8231 },
            { name: "Đà Nẵng", lon: 108.2022, lat: 16.0471 },
            { name: "Hải Phòng", lon: 106.6823, lat: 20.8449 },
            { name: "Cần Thơ", lon: 105.7689, lat: 10.0452 },
            { name: "Huế", lon: 107.5800, lat: 16.4637 },
        ];

        majorCities.forEach(city => {
            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
                point: {
                pixelSize: 10,
                color: Cesium.Color.BLUE,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                label: {
                text: city.name,
                font: "bold 25px 'Times New Roman', serif",
                fillColor: Cesium.Color.BLACK,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -15),
                scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 1500000, 0.0)
                }
            });
        });