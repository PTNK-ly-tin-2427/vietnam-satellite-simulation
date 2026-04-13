function plot_win_rate_pairwise()
    % =========================================================================
    % 1. CẤU HÌNH & DỮ LIỆU
    % =========================================================================
    
    file_path = 'D:\NCKH\vietnam-satellite-simulation\data\win_rate\win_rate_pairwise.csv';
    output_folder = 'D:\NCKH\vietnam-satellite-simulation\plots';
    
    if ~exist(output_folder, 'dir')
        mkdir(output_folder);
    end

    % Danh sách các thuật toán đối thủ của NSGA-NC
    % Tên này PHẢI KHỚP với tên cột trong file CSV
    target_algos = {'NSGA-C50', 'NSGA-C60', 'NSGA-C70', 'NSGA-C80', ...
                    'NSGA-C90', 'NSGA-C95', 'NSGA-C99', 'NSGA-C100', 'MOGA-WS'};
    
    % Tên hiển thị ngắn gọn trên biểu đồ
    short_labels = {'C50', 'C60', 'C70', 'C80', 'C90', 'C95', 'C99', 'C100', 'WS'};

    % Bảng màu Tab10 chuẩn (để đồng bộ màu sắc với các biểu đồ trước)
    % Index: 1:Blue, 2:Orange, 3:Green, 4:Red, 5:Purple, 6:Brown, 7:Pink, 8:Gray, 9:Olive, 10:Cyan
    tab10_colors = [
        0.1216, 0.4667, 0.7059; % 1. NC
        1.0000, 0.4980, 0.0549; % 2. C50
        0.1725, 0.6275, 0.1725; % 3. C60
        0.8392, 0.1529, 0.1569; % 4. C70
        0.5804, 0.4039, 0.7412; % 5. C80
        0.5490, 0.3373, 0.2941; % 6. C90
        0.8902, 0.4667, 0.7608; % 7. C95
        0.4980, 0.4980, 0.4980; % 8. C99
        0.7373, 0.7412, 0.1333; % 9. C100
        0.0902, 0.7451, 0.8118  % 10. WS
    ];
    
    % Map màu tương ứng cho danh sách target_algos (Bắt đầu từ C50 là màu số 2)
    color_indices = [2, 3, 4, 5, 6, 7, 8, 9, 10];

    % =========================================================================
    % 2. ĐỌC FILE CSV VÀ TRÍCH XUẤT DỮ LIỆU
    % =========================================================================
    
    fprintf('Đang đọc file: %s ...\n', file_path);
    if ~exist(file_path, 'file')
        error('Không tìm thấy file csv!');
    end
    
    % Quan trọng: Dùng 'preserve' để giữ nguyên tên cột (ví dụ "NSGA-C50" thay vì "NSGA_C50")
    opts = detectImportOptions(file_path);
    opts.VariableNamingRule = 'preserve'; 
    df = readtable(file_path, opts);
    
    % Mảng chứa giá trị Win Rate tìm được
    values = zeros(1, length(target_algos));
    
    for i = 1:length(target_algos)
        algo_name = target_algos{i};
        
        % Tạo chuỗi tìm kiếm chính xác trong cột Comparison
        % Mẫu: "NSGA-NC vs [Tên_Algo] (100% Coverage)"
        search_str = sprintf('NSGA-NC vs %s (100%% Coverage)', algo_name);
        
        % Tìm dòng chứa chuỗi này
        % Lưu ý: Cột Comparison thường là cột đầu tiên
        row_idx = find(strcmp(df.Comparison, search_str));
        
        if isempty(row_idx)
            warning('Không tìm thấy dòng dữ liệu cho cặp đấu: %s', search_str);
            val = 0;
        else
            % Lấy giá trị tại cột có tên trùng với algo_name
            % Ví dụ: Dòng "NSGA-NC vs NSGA-C50...", lấy giá trị cột "NSGA-C50"
            if ismember(algo_name, df.Properties.VariableNames)
                val = df.(algo_name)(row_idx);
            else
                warning('Không tìm thấy cột %s trong file CSV.', algo_name);
                val = 0;
            end
        end
        
        values(i) = val;
    end
    
    % Chuyển đổi sang phần trăm (nếu dữ liệu đang là 0.xx)
    if max(values) <= 1.0
        values = values * 100;
    end
    
    % Tính phần bù (để vẽ cột nền màu xám)
    remainder = 100 - values;
    plot_data = [values; remainder]'; % Chuyển vị thành cột để vẽ

    % =========================================================================
    % 3. VẼ BIỂU ĐỒ (STACKED BAR)
    % =========================================================================
    
    f = figure('Name', 'Pairwise Win Rate (100% Coverage)', 'Color', 'w', 'Position', [100, 100, 1200, 600]);
    h = bar(plot_data, 'stacked');
    
    % --- Tùy chỉnh màu sắc ---
    
    % Layer 1: Win Rate (Cần tô màu riêng từng cột)
    h(1).FaceColor = 'flat'; 
    h(1).EdgeColor = 'none';
    h(1).BarWidth = 0.8;
    
    % Gán màu từ bảng tab10 cho từng cột
    for i = 1:length(target_algos)
        c_idx = color_indices(i);
        h(1).CData(i, :) = tab10_colors(c_idx, :);
    end
    
    % Layer 2: Background (Màu xám nhạt)
    h(2).FaceColor = [230/255, 230/255, 235/255]; 
    h(2).EdgeColor = 'none';
    h(2).BarWidth = 0.8;

    % =========================================================================
    % 4. THÊM NHÃN VÀ TRANG TRÍ
    % =========================================================================
    
    for i = 1:length(values)
        val = values(i);
        
        % 1. Hiển thị số % (ví dụ: "60%")
        % Nếu cột thấp quá (<15%), đẩy chữ lên trên cột màu xám cho dễ đọc
        if val > 15
            y_pos = val - 5;
            txt_color = 'white';
        else
            y_pos = val + 5;
            txt_color = 'k'; % Màu đen
        end
        
        text(i, y_pos, sprintf('%.1f%%', val), ...
            'Color', txt_color, ...
            'FontSize', 12, ...
            'FontWeight', 'bold', ...
            'HorizontalAlignment', 'center');
        
        % 2. Hiển thị tên ngắn (C50, C60...) dưới chân cột
        text(i, 3, short_labels{i}, ...
            'Color', 'white', ...
            'FontSize', 11, ...
            'FontWeight', 'bold', ...
            'HorizontalAlignment', 'center');
    end
    
    % Tinh chỉnh trục
    axis off;        % Tắt trục tọa độ
    ylim([0 100]);   % Cố định chiều cao 100%
    
    % Tiêu đề
    t = title('Win Rate vs. NSGA-NC (Success Rate on 100% Coverage Solutions)', ...
              'FontSize', 16, 'FontWeight', 'bold');
    t.Position(2) = 105; % Đẩy tiêu đề lên cao một chút
    
    % Vẽ đường kẻ ngang mờ (Grid lines) thủ công cho đẹp
    hold on;
    for y = 20:20:80
        yline(y, 'Color', [0.7 0.7 0.7], 'LineWidth', 0.8, 'LineStyle', ':', 'Alpha', 0.6);
    end
    
    % =========================================================================
    % 5. LƯU FILE
    % =========================================================================
    
    output_fig = fullfile(output_folder, 'win_rate_pairwise_100_coverage.fig');
    savefig(f, output_fig);
    
    output_png = fullfile(output_folder, 'win_rate_pairwise_100_coverage.png');
    saveas(f, output_png);
    
    fprintf('Đã lưu biểu đồ tại:\n - %s\n - %s\n', output_fig, output_png);
end