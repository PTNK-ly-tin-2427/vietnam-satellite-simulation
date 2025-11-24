%% ================== 1. CONFIGURATION & INPUTS ==================
clc; clear; close all;

% Định nghĩa đường dẫn file
vn_gdf_path = 'D:\NCKH\vietnam-satellite-simulation\data_internet\VNM_1.geojson';
pop_df_path = 'D:\NCKH\vietnam-satellite-simulation\data_internet\vnm_pd_2020_1km_UNadj_ASCII_XYZ.csv';
perf_df_path = 'D:\NCKH\vietnam-satellite-simulation\data_internet\performance_comparison.csv';

% Output path (để lưu file .fig cùng thư mục data)
output_dir = fileparts(vn_gdf_path);

%% ================== 2. LOAD DATA ==================
fprintf('Đang đọc dữ liệu...\n');

% Đọc file CSV
pop_df = readtable(pop_df_path);
perf_df = readtable(perf_df_path, 'VariableNamingRule', 'preserve');

% Đọc file GeoJSON (Yêu cầu Mapping Toolbox R2021b+)
try
    vn_gdf = readgeotable(vn_gdf_path);
    hasMapData = true;
catch
    warning('Không thể đọc file GeoJSON (có thể do thiếu Mapping Toolbox). Sẽ bỏ qua vẽ biên giới.');
    hasMapData = false;
end

%% ================== 3. DATA PROCESSING ==================
% Lấy thông tin chùm vệ tinh đầu tiên (Target Constellation)
target_const = perf_df.constellation{1};
% Lấy giá trị throughput (tương đương throughputs[target_const] trong Python)
throughput_supply_km2 = perf_df.("Throughput (Mbps)")(1);

fprintf('Constellation: %s | Supply: %.2f Mbps/km2\n', target_const, throughput_supply_km2);

% --- Tính toán Concurrency Ratio (Vectorized) ---
Z = pop_df.Z; % Population density
concurrency_ratio = zeros(size(Z));

% Logic: >= 2000 -> 0.75; >= 200 -> 0.30; < 200 -> 0.15
concurrency_ratio(Z >= 2000) = 0.75;
concurrency_ratio(Z >= 200 & Z < 2000) = 0.30;
concurrency_ratio(Z < 200) = 0.15;

% Tính Active Users
active_users = Z .* concurrency_ratio;

% Tính Throughput per User
% Logic Python: supply / users if users >= 1 else supply
throughput_per_user = throughput_supply_km2 ./ active_users;
throughput_per_user(active_users < 1) = throughput_supply_km2;

%% ================== 4. PREPARE PLOTTING COLORS ==================
% Định nghĩa Bins và Labels
bins = [0, 1, 2, 5, 10, 20, 50, 100];
labels = {
    '0-1 Mbps (Low usage)';
    '1-2 Mbps (Basic Web)';
    '2-5 Mbps (Video Call)';
    '5-10 Mbps (HD Streaming)';
    '10-20 Mbps (Full HD/4K)';
    '20-50 Mbps (High Speed)';
    '50-100 Mbps (Ultra/RT)'
};

% Định nghĩa màu (HEX -> RGB)
hexColors = {'#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850', '#006837'};
cmap = zeros(length(hexColors), 3);
for i = 1:length(hexColors)
    cmap(i, :) = hex2rgb(hexColors{i});
end

% Discretize dữ liệu để tô màu theo bin (thay vì nội suy tuyến tính)
% Hàm discretize trả về index (1 đến 7) tương ứng với bin
color_indices = discretize(throughput_per_user, bins);

%% ================== 5. PLOTTING ==================
fprintf('Đang vẽ biểu đồ...\n');

fig = figure('Name', 'User Throughput Density', 'Color', 'w', 'Position', [100, 100, 1000, 800]);
ax = axes(fig);
hold on; axis equal; box on;

% 1. Vẽ biên giới Việt Nam (nếu có dữ liệu GeoJSON)
if hasMapData
    % geoshow tự động nhận diện Lat/Lon trong table
    geoshow(vn_gdf, 'FaceColor', 'none', 'EdgeColor', 'k', 'LineWidth', 1, 'Parent', ax);
end

% 2. Vẽ Scatter Plot (Heatmap)
% Dùng color_indices để map vào màu đã định nghĩa
scatter(pop_df.X, pop_df.Y, 45, color_indices, 'filled', 's'); 

% 3. Cấu hình trục và tiêu đề
xlabel('Longitude', 'FontSize', 12);
ylabel('Latitude', 'FontSize', 12);
title({'\bf Estimated User Throughput Density'; '(Based on Peak Hour Concurrency)'}, ...
      'FontSize', 16, 'Interpreter', 'tex');

% 4. Cấu hình Colorbar tùy chỉnh (Discrete)
colormap(ax, cmap); % Set colormap cho axes hiện tại
clim(ax, [1, 8]);   % Set giới hạn màu từ index 1 đến 8 (để khớp 7 khoảng màu)

c = colorbar(ax);
c.Label.String = '\bf Quality of Service (QoS) Level';
c.Label.FontSize = 13;
c.Label.Interpreter = 'tex';

% Chỉnh vị trí Ticks nằm giữa các khoảng màu
c.Ticks = 1.5 : 1 : 7.5; 
c.TickLabels = labels;

% Grid và giới hạn khung nhìn
grid on;
ax.GridAlpha = 0.3;
ax.GridLineStyle = '--';
xlim([102, 110]); % Zoom vào khu vực VN (tùy chỉnh nếu cần)
ylim([8, 24]);

%% ================== 6. EXPORT ==================
savePath = fullfile(output_dir, 'estimated_throughput_map.fig');
savefig(fig, savePath);

% Lưu thêm ảnh PNG để xem nhanh
savePathImg = fullfile(output_dir, 'estimated_throughput_map.png');
exportgraphics(fig, savePathImg, 'Resolution', 300);

fprintf('🎉 Hoàn tất! File đã lưu tại: %s\n', savePath);


%% ================== HELPER FUNCTIONS ==================
function rgb = hex2rgb(hexStr)
    % Chuyển đổi mã Hex (#RRGGBB) sang RGB [0-1]
    hexStr = strrep(hexStr, '#', '');
    if length(hexStr) ~= 6
        error('Mã hex không hợp lệ');
    end
    r = sscanf(hexStr(1:2), '%x') / 255;
    g = sscanf(hexStr(3:4), '%x') / 255;
    b = sscanf(hexStr(5:6), '%x') / 255;
    rgb = [r, g, b];
end