%% ==================== 1. CONFIGURATION & LOAD DATA ====================
clc; clear; close all;

% --- CẤU HÌNH ĐƯỜNG DẪN ---
% Đảm bảo đường dẫn này đúng trên máy bạn
rootDir = 'D:\NCKH\vietnam-satellite-simulation\data_internet';
outputDir = rootDir; 

cases = {
    '503km (case 90)', 'data_internet_90';
    '665km (case 95)', 'data_internet_95';
    '598km (case 80)', 'data_internet_80'
};

timeSteps = 0:720; % Số bước thời gian
allData = struct(); % Biến lưu dữ liệu

fprintf('🚀 Bắt đầu quá trình xử lý...\n');

% --- LOAD DỮ LIỆU ---
validDataCount = 0;
for c = 1:size(cases, 1)
    caseName = cases{c, 1};
    folderName = cases{c, 2};
    casePath = fullfile(rootDir, folderName);
    
    fprintf('📂 Đang đọc: %s...\n', caseName);
    
    t_vals = []; coverage_vals = []; snr_vals = []; thr_vals = []; avail_vals = [];
    
    for t = timeSteps
        currentFile = fullfile(casePath, num2str(t), 'summary.csv');
        if exist(currentFile, 'file')
            try
                opts = detectImportOptions(currentFile);
                opts.VariableNamingRule = 'preserve';
                T = readtable(currentFile, opts);
                if ~isempty(T)
                    t_vals = [t_vals; t];
                    coverage_vals = [coverage_vals; T.coverage_pct(1)];
                    snr_vals = [snr_vals; T.("avg_snr_dB")(1)];
                    thr_vals = [thr_vals; T.("avg_thr_Mbps")(1)];
                    avail_vals = [avail_vals; T.("avg_availability_pct")(1)];
                end
            catch
                % Bỏ qua lỗi nhỏ để chạy tiếp
            end
        end
    end
    
    if ~isempty(t_vals)
        validDataCount = validDataCount + 1;
        allData(validDataCount).name = caseName;
        allData(validDataCount).time = t_vals;
        allData(validDataCount).coverage = coverage_vals;
        allData(validDataCount).snr = snr_vals;
        allData(validDataCount).throughput = thr_vals;
        allData(validDataCount).availability = avail_vals;
        fprintf('   ✅ Đã load %d dòng dữ liệu.\n', length(t_vals));
    else
        fprintf('   ⚠️ Không tìm thấy dữ liệu hợp lệ cho case này.\n');
    end
end

if validDataCount == 0
    error('❌ KHÔNG CÓ DỮ LIỆU NÀO ĐƯỢC LOAD. Vui lòng kiểm tra lại đường dẫn rootDir!');
end

%% ==================== 2. HEATMAP + LINE PLOT COMPARISON ====================
fprintf('\n🎨 Đang vẽ biểu đồ kết hợp (Heatmap + Line Plot)...\n');

% Cấu hình màu
colorMap = containers.Map();
colorMap('503km (case 90)') = [31, 119, 180] / 255;
colorMap('665km (case 95)') = [44, 160, 44] / 255;
colorMap('598km (case 80)') = [255, 127, 14] / 255;

constellation_order = {'503km (case 90)', '665km (case 95)', '598km (case 80)'};

% --- Chuẩn bị dữ liệu cho Heatmap ---
% Tính trung bình các thông số
numCases = length(constellation_order);
statsData = zeros(numCases, 4); % Ma trận số liệu: Cov, SNR, Thr, Avail
rowNames = constellation_order;

for i = 1:numCases
    targetName = constellation_order{i};
    % Tìm case trong allData
    foundIdx = -1;
    for k = 1:length(allData)
        if strcmp(allData(k).name, targetName)
            foundIdx = k; break;
        end
    end
    
    if foundIdx ~= -1
        statsData(i, 1) = mean(allData(foundIdx).coverage);
        statsData(i, 2) = mean(allData(foundIdx).snr);
        statsData(i, 3) = mean(allData(foundIdx).throughput);
        statsData(i, 4) = mean(allData(foundIdx).availability);
    end
end

% --- VẼ BIỂU ĐỒ (Sử dụng TiledLayout thay cho Subplot) ---
fig = figure('Name', 'Heatmap_Line_Comparison', 'Position', [100, 100, 1400, 600], 'Color', 'w');

% Tạo layout 1 hàng 2 cột
t = tiledlayout(1, 2, 'TileSpacing', 'compact', 'Padding', 'compact');

% === TILE 1: HEATMAP ===
nexttile; % Đặt chỗ cho tile đầu tiên
xLabels = {'Coverage (%)', 'SNR (dB)', 'Throughput (Mbps)', 'Availability (%)'};

% Vẽ heatmap vào layout 't'
h = heatmap(xLabels, rowNames, statsData);
h.Layout.Tile = 1; % Gán vào tile 1
h.Title = '(a) Average Performance Comparison';
h.CellLabelFormat = '%.1f';
h.FontSize = 11;

% Tạo Colormap (Đỏ -> Vàng -> Xanh)
n = 100;
redToGreen = [linspace(1,1,50)', linspace(0,1,50)', zeros(50,1); ...
              linspace(1,0,50)', linspace(1,0.6,50)', zeros(50,1)];
h.Colormap = redToGreen;

% === TILE 2: LINE PLOT ===
ax2 = nexttile; % Chuyển vào ô thứ hai
hold(ax2, 'on'); grid(ax2, 'on'); box(ax2, 'on');

for i = 1:length(constellation_order)
    cName = constellation_order{i};
    
    % Tìm data
    idx = -1;
    for k = 1:length(allData)
        if strcmp(allData(k).name, cName)
            idx = k; break;
        end
    end
    
    if idx ~= -1
        t_plot = allData(idx).time;
        cov_plot = allData(idx).coverage;
        [t_plot, sortId] = sort(t_plot); % Sort cho chắc chắn
        cov_plot = cov_plot(sortId);
        
        if isKey(colorMap, cName)
            cColor = colorMap(cName);
        else
            cColor = [0 0 0]; % Mặc định đen nếu lỗi key
        end
        
        plot(ax2, t_plot, cov_plot, 'LineWidth', 2.0, 'Color', cColor, ...
             'DisplayName', cName, 'Marker', 'o', 'MarkerSize', 3, ...
             'MarkerFaceColor', cColor);
    end
end

% Trang trí Line Plot
xlabel(ax2, 'Timestep', 'FontSize', 12);
ylabel(ax2, 'Coverage (%)', 'FontSize', 12);
title(ax2, '(b) Coverage Temporal Evolution', 'FontSize', 14, 'FontWeight', 'bold');
legend(ax2, 'show', 'Location', 'southeast');
ylim(ax2, [0, 105]);

% Vẽ đường 95% threshold
yline(ax2, 95, '--r', 'LineWidth', 1.5, 'Alpha', 0.7);
text(ax2, 0.02, 0.96, '95% Coverage Target', 'Units', 'normalized', ...
     'Color', 'red', 'FontSize', 10, 'FontWeight', 'bold');

% === XUẤT FILE ===
savePathFig = fullfile(outputDir, 'heatmap_line_comparison.fig');
savePathPng = fullfile(outputDir, 'heatmap_line_comparison.png');

savefig(fig, savePathFig);
exportgraphics(fig, savePathPng, 'Resolution', 300);

fprintf('🎉 Xong! File đã lưu tại:\n -> %s\n -> %s\n', savePathFig, savePathPng);