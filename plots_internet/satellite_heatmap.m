%% ==================== CONFIGURATION ====================
clc; clear; close all;

% --- ĐƯỜNG DẪN GỐC ---
rootDir = 'D:\NCKH\vietnam-satellite-simulation\data_internet';

% File input cho phần phân tích đảo (Part 1)
% Giả sử file details nằm trong thư mục con data_internet_95 bước 0 (theo prompt cũ)
% Hoặc bạn có thể sửa đường dẫn này trỏ thẳng đến file details.csv bạn muốn quét
detailsPath = fullfile(rootDir, 'data_internet_95', '0', 'details.csv'); 

% File input cho phần vẽ Map (Part 2)
vn_gdf_path = fullfile(rootDir, 'VNM_1.geojson');
pop_df_path = fullfile(rootDir, 'vnm_pd_2020_1km_UNadj_ASCII_XYZ.csv');
perf_df_path = fullfile(rootDir, 'performance_comparison.csv');

output_dir = rootDir;

%% =============================================================
%% PART 1: ANALYZE ISLAND POINTS (PHÂN TÍCH VÙNG LÕI ĐẢO)
%% =============================================================
fprintf('================================================================\n');
fprintf('🔍 PART 1: PHÂN TÍCH ĐIỂM ĐẢO TỪ FILE DETAILS\n');
fprintf('   File: %s\n', detailsPath);
fprintf('================================================================\n');

% Cấu hình Bounding Box
HS_LAT_RANGE = [15.4, 17.5];
HS_LON_RANGE = [111.0, 113.5];

TS_LAT_RANGE = [6.5, 12.0];
TS_LON_RANGE = [111.5, 117.2];

if exist(detailsPath, 'file')
    try
        % Đọc file
        opts = detectImportOptions(detailsPath);
        opts.VariableNamingRule = 'preserve';
        df = readtable(detailsPath, opts);
        
        % --- 1. Khu vực Hoàng Sa ---
        hs_mask = (df.lat >= HS_LAT_RANGE(1)) & (df.lat <= HS_LAT_RANGE(2)) & ...
                  (df.lon >= HS_LON_RANGE(1)) & (df.lon <= HS_LON_RANGE(2));
        hs_points = df(hs_mask, :);
        
        % Loại bỏ trùng lặp (lat, lon)
        [~, uniqueIdx] = unique(hs_points(:, {'lat', 'lon'}));
        hs_unique = hs_points(uniqueIdx, :);
        
        printIslandResults('HOÀNG SA', hs_unique, HS_LAT_RANGE, HS_LON_RANGE);
        
        % --- 2. Khu vực Trường Sa ---
        ts_mask = (df.lat >= TS_LAT_RANGE(1)) & (df.lat <= TS_LAT_RANGE(2)) & ...
                  (df.lon >= TS_LON_RANGE(1)) & (df.lon <= TS_LON_RANGE(2));
        ts_points = df(ts_mask, :);
        
        % Loại bỏ trùng lặp
        [~, uniqueIdx] = unique(ts_points(:, {'lat', 'lon'}));
        ts_unique = ts_points(uniqueIdx, :);
        
        printIslandResults('TRƯỜNG SA', ts_unique, TS_LAT_RANGE, TS_LON_RANGE);
        
    catch ME
        fprintf('❌ Lỗi xử lý file CSV: %s\n', ME.message);
    end
else
    fprintf('❌ Không tìm thấy file details.csv tại đường dẫn trên.\n');
end

%% =============================================================
%% PART 2: HEATMAP VISUALIZATION (VẼ BẢN ĐỒ)
%% =============================================================
fprintf('\n================================================================\n');
fprintf('🎨 PART 2: VẼ BẢN ĐỒ HEATMAP (KÈM DỮ LIỆU ĐẢO BỔ SUNG)\n');
fprintf('================================================================\n');

% 1. Load Data
pop_df = readtable(pop_df_path); % Cột: X, Y, Z
perf_df = readtable(perf_df_path, 'VariableNamingRule', 'preserve');

try
    vn_gdf = readgeotable(vn_gdf_path);
    hasMap = true;
catch
    warning('Thiếu Mapping Toolbox hoặc lỗi file GeoJSON. Sẽ bỏ qua vẽ biên giới.');
    hasMap = false;
end

% 2. Lấy thông số vệ tinh (Case đầu tiên)
target_const = perf_df.constellation{1};
throughput_supply_km2 = perf_df.("Throughput (Mbps)")(1);
fprintf('📡 Constellation: %s | Supply: %.2f Mbps/km2\n', target_const, throughput_supply_km2);

% 3. Bổ sung dữ liệu đảo (Manual Insert)
% Tạo các mảng dữ liệu đảo tương ứng Python code
lat_islands = [ ...
    16.3533; 16.4533; 16.4533; ... % HS
    7.5533; 7.6533; 7.6533; 7.7533; 8.1533; 8.3533; ... % TS
    10.329969200802104; 10.89014760153961; 8.8533; 9.6533; ...
    9.7533; 10.5533; 10.8533; 10.8533; 10.8533; 11.0533];

lon_islands = [ ...
    112.0421; 111.5421; 111.7421; ... % HS
    111.5421; 113.8421; 113.9421; 114.1421; 114.7421; 115.2421; ... % TS
    114.68588732078119; 114.56660587630368; 114.6421; 112.9421; ...
    116.4421; 116.9421; 116.2421; 116.6421; 116.8421; 114.3421];

z_islands = repmat(50, length(lat_islands), 1); % Mật độ Z = 50

% Tạo table đảo và gộp
island_tbl = table(lon_islands, lat_islands, z_islands, 'VariableNames', {'X', 'Y', 'Z'});
pop_df = [pop_df; island_tbl];
fprintf('➕ Đã thêm %d điểm đảo vào dữ liệu.\n', height(island_tbl));

% 4. Tính toán Logic (Vectorized)
% Concurrency Ratio logic
concurrency_ratio = zeros(height(pop_df), 1);
Z = pop_df.Z;
concurrency_ratio(Z >= 2000) = 0.75;
concurrency_ratio(Z >= 200 & Z < 2000) = 0.30;
concurrency_ratio(Z < 200) = 0.15;

% Active Users & Throughput per User
active_users = Z .* concurrency_ratio;
throughput_per_user = throughput_supply_km2 ./ active_users;
throughput_per_user(active_users < 1) = throughput_supply_km2; % Nếu user < 1 thì max supply

% 5. Cấu hình màu sắc (Color Bins)
bins = [0, 1, 2, 5, 10, 20, 50, 100];
labels = {'0-1 Mbps', '1-2 Mbps', '2-5 Mbps', '5-10 Mbps', '10-20 Mbps', '20-50 Mbps', '50-100 Mbps'};
hexColors = {'#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850', '#006837'};

% Chuyển Hex sang RGB
customCmap = zeros(length(hexColors), 3);
for i = 1:length(hexColors)
    customCmap(i, :) = sscanf(hexColors{i}(2:end), '%2x%2x%2x')' / 255;
end

% Discretize dữ liệu để tô màu theo bin
color_indices = discretize(throughput_per_user, bins);

% 6. Vẽ Biểu Đồ
fig = figure('Name', 'Vietnam Satellite Throughput', 'Color', 'w', 'Position', [50, 50, 1000, 850]);
ax = axes(fig);
hold on; axis equal; box on; grid on;

% Vẽ biên giới VN
if hasMap
    geoshow(vn_gdf, 'FaceColor', 'none', 'EdgeColor', 'k', 'LineWidth', 1, 'Parent', ax);
end

% Vẽ Scatter (Heatmap)
scatter(pop_df.X, pop_df.Y, 45, color_indices, 'filled', 's');

% Trang trí
title({'Estimated User Throughput Density', '(Based on Peak Hour Concurrency)'}, 'FontSize', 14, 'FontWeight', 'bold');
xlabel('Longitude'); ylabel('Latitude');
xlim([102, 118]); ylim([6, 24]); % Zoom bao quát cả Trường Sa

% Colorbar tùy chỉnh
colormap(ax, customCmap);
clim(ax, [1, 8]); % 7 khoảng màu tương ứng index 1->7
c = colorbar(ax);
c.Label.String = 'Quality of Service (QoS)';
c.Label.FontSize = 12;
c.Label.FontWeight = 'bold';
c.Ticks = 1.5 : 1 : 7.5; % Đặt tick giữa các ô màu
c.TickLabels = labels;

% Xuất file
savePath = fullfile(output_dir, 'estimated_throughput_map_full.fig');
savefig(fig, savePath);
savePathImg = fullfile(output_dir, 'estimated_throughput_map_full.png');
exportgraphics(fig, savePathImg, 'Resolution', 300);
fprintf('🎉 Hoàn tất! File đã lưu tại: %s\n', savePath);


%% ==================== LOCAL FUNCTIONS ====================
function printIslandResults(areaName, data, latRange, lonRange)
    fprintf('\n🏝️  KHU VỰC %s (Box: %.1f-%.1f N, %.1f-%.1f E)\n', areaName, latRange, lonRange);
    fprintf('%s\n', repmat('-', 1, 80));
    
    if ~isempty(data)
        fprintf('✅ Tìm thấy: %d điểm duy nhất.\n', height(data));
        fprintf('%-10s %-10s %-15s %-10s %s\n', 'Lat', 'Lon', 'Beam ID', 'SNR (dB)', 'Thr (Mbps)');
        fprintf('%s\n', repmat('-', 1, 80));
        
        for i = 1:height(data)
            row = data(i, :);
            % Xử lý beam_id (nếu là số thì chuyển string, nếu string giữ nguyên)
            if isnumeric(row.beam_id)
                b_id = num2str(row.beam_id);
            else
                b_id = char(row.beam_id);
            end
            
            fprintf('%-10.4f %-10.4f %-15s %-10.2f %.2f\n', ...
                row.lat, row.lon, b_id, row.("SNR_dB"), row.("throughput_Mbps"));
        end
    else
        fprintf('⚠️ Không tìm thấy điểm nào.\n');
    end
end