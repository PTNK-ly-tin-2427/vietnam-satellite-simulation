function plot_win_rate()
    % =========================================================================
    % 1. CẤU HÌNH ĐƯỜNG DẪN VÀ MÀU SẮC
    % =========================================================================
    
    file_path = 'D:\NCKH\vietnam-satellite-simulation\data\win_rate\win_rate_80_90_95.csv';
    output_folder = 'D:\NCKH\vietnam-satellite-simulation\plots';
    
    if ~exist(output_folder, 'dir')
        mkdir(output_folder);
    end

    % Danh sách các thuật toán cần vẽ trong biểu đồ tròn này
    target_labels = {'NSGA-C80', 'NSGA-C90', 'NSGA-C95'};
    
    % Bảng màu chuẩn Tab10 (Giống các biểu đồ trước để đồng bộ)
    % Thứ tự: Blue, Orange, Green, Red, Purple, Brown, Pink, Gray, Olive, Cyan
    tab10_colors = [
        0.1216, 0.4667, 0.7059; % 1. NC
        1.0000, 0.4980, 0.0549; % 2. C50
        0.1725, 0.6275, 0.1725; % 3. C60
        0.8392, 0.1529, 0.1569; % 4. C70
        0.5804, 0.4039, 0.7412; % 5. C80 (Tím)
        0.5490, 0.3373, 0.2941; % 6. C90 (Nâu)
        0.8902, 0.4667, 0.7608; % 7. C95 (Hồng)
        0.4980, 0.4980, 0.4980; % 8. C99
        0.7373, 0.7412, 0.1333; % 9. C100
        0.0902, 0.7451, 0.8118  % 10. WS
    ];

    % Mapping màu: C80 (index 5), C90 (index 6), C95 (index 7)
    target_colors = [
        tab10_colors(5, :); % Màu cho C80
        tab10_colors(6, :); % Màu cho C90
        tab10_colors(7, :)  % Màu cho C95
    ];

    % =========================================================================
    % 2. ĐỌC DỮ LIỆU TỪ CSV
    % =========================================================================
    
    if ~exist(file_path, 'file')
        error('Không tìm thấy file tại: %s', file_path);
    end
    
    opts = detectImportOptions(file_path);
    opts.VariableNamingRule = 'preserve'; 
    df = readtable(file_path, opts);
    
    % --- XỬ LÝ DỮ LIỆU ---
    % Giả định 1: File CSV có cột tên là 'NSGA-C80', 'NSGA-C90'... và giá trị nằm ở dòng đầu tiên.
    % Giả định 2: Hoặc file có cột "Algorithm" và cột "WinRate".
    
    data_values = [];
    
    % Cách xử lý linh hoạt: Tìm tên cột trùng với target_labels
    for i = 1:length(target_labels)
        lab = target_labels{i};
        if ismember(lab, df.Properties.VariableNames)
            % Nếu tên thuật toán là tên cột -> Lấy giá trị dòng đầu tiên
            val = df.(lab)(1);
            data_values(end+1) = val;
        else
            % Nếu không tìm thấy cột, thử tìm trong dữ liệu (trường hợp cột Algorithm/Value)
            % Đoạn này tùy biến theo cấu trúc file thực tế của bạn
            % Tạm thời gán 0 và cảnh báo nếu không thấy
            warning('Không tìm thấy cột dữ liệu cho %s. Gán bằng 0.', lab);
            data_values(end+1) = 0;
        end
    end
    
    % Kiểm tra tổng (để tính %)
    total = sum(data_values);
    if total == 0
        error('Dữ liệu đọc được toàn bằng 0 hoặc rỗng. Kiểm tra lại CSV.');
    end
    
    % =========================================================================
    % 3. VẼ BIỂU ĐỒ
    % =========================================================================
    
    % Tạo nhãn hiển thị: "Tên\nPhần trăm"
    formattedLabels = cell(size(data_values));
    for i = 1:length(data_values)
        % Tính phần trăm
        percent = (data_values(i) / total) * 100;
        formattedLabels{i} = sprintf('%s\n%.1f%%', target_labels{i}, percent);
    end
    
    f = figure('Name', 'Win Rate Distribution', 'Color', 'w');
    h = pie(data_values, formattedLabels);
    
    % =========================================================================
    % 4. TÙY CHỈNH GIAO DIỆN & MÀU SẮC
    % =========================================================================
    
    for i = 1:length(data_values)
        idx_patch = 2*i - 1; % Miếng bánh
        idx_text = 2*i;      % Nhãn chữ
        
        % 1. Set màu đúng theo chuẩn Tab10
        h(idx_patch).FaceColor = target_colors(i, :);
        h(idx_patch).EdgeColor = 'w';
        h(idx_patch).LineWidth = 1.5;
        h(idx_patch).FaceAlpha = 0.9; % Hơi trong suốt một chút cho đẹp
        
        % 2. Chỉnh Font chữ
        h(idx_text).FontSize = 13;
        h(idx_text).FontWeight = 'bold';
        h(idx_text).Color = 'k';
        h(idx_text).Interpreter = 'none'; % Để hiển thị đúng dấu gạch ngang (-)
        
        % 3. Đẩy nhãn ra xa tâm một chút
        pos = h(idx_text).Position;
        % Điều chỉnh khoảng cách label tùy vào vị trí
        h(idx_text).Position = pos * 1.15; 
    end
    
    title('Win Rate Distribution (C80 vs C90 vs C95)', 'FontSize', 14, 'FontWeight', 'bold');
    
    % =========================================================================
    % 5. LƯU FILE
    % =========================================================================
    
    output_path = fullfile(output_folder, 'win_rate_distribution.fig');
    savefig(f, output_path);
    fprintf('Đã lưu biểu đồ tại: %s\n', output_path);
end