function plot_diversity()
    % =========================================================================
    % 1. CẤU HÌNH ĐƯỜNG DẪN VÀ FILE
    % =========================================================================
    
    data_base_path = 'D:\NCKH\vietnam-satellite-simulation\data';
    output_folder = 'D:\NCKH\vietnam-satellite-simulation\plots';
    
    % Tên folder và tên file chứa dữ liệu diversity
    % Giả định file nằm tại: .../data/pop_diversity/pop_diversity.csv
    target_folder_name = 'pop_diversity'; 
    target_file_name = 'pop_diversity.csv'; 
    
    if ~exist(output_folder, 'dir')
        mkdir(output_folder);
    end

    % Danh sách các thuật toán (Tên cột trong CSV)
    CUSTOM_LABELS = {
        'NSGA-NC', 'NSGA-C50', 'NSGA-C60', 'NSGA-C70', 'NSGA-C80', ...
        'NSGA-C90', 'NSGA-C95', 'NSGA-C99', 'NSGA-C100', 'MOGA-WS'
    };
    
    % Style configuration (Giống Python)
    markers = {'o', 's', '^', 'd', 'v'}; 
    linestyles = {'-', '--'};
    % Bảng màu Tab10
    tab10_colors = [
        0.1216, 0.4667, 0.7059; 1.0000, 0.4980, 0.0549; 0.1725, 0.6275, 0.1725; 
        0.8392, 0.1529, 0.1569; 0.5804, 0.4039, 0.7412; 0.5490, 0.3373, 0.2941; 
        0.8902, 0.4667, 0.7608; 0.4980, 0.4980, 0.4980; 0.7373, 0.7412, 0.1333; 
        0.0902, 0.7451, 0.8118
    ];

    % =========================================================================
    % 2. LOAD DỮ LIỆU
    % =========================================================================
    
    file_path = fullfile(data_base_path, target_folder_name, target_file_name);
    fprintf('Đang đọc file: %s ...\n', file_path);
    
    if ~exist(file_path, 'file')
        error('Không tìm thấy file tại: %s. Vui lòng kiểm tra lại đường dẫn!', file_path);
    end
    
    opts = detectImportOptions(file_path);
    % Quan trọng: Giữ nguyên tên cột (vd: "NSGA-NC" thay vì bị đổi thành "NSGA_NC")
    opts.VariableNamingRule = 'preserve'; 
    df_diversity = readtable(file_path, opts);

    % =========================================================================
    % 3. VẼ ĐỒ THỊ
    % =========================================================================
    
    % Tạo Figure
    f = figure('Name', 'Population Diversity', 'Color', 'w', 'Position', [100, 100, 1000, 700]);
    ax = axes(f);
    hold(ax, 'on');
    
    marker_idx = 1;
    linestyle_idx = 1;
    color_idx = 1;
    
    % Duyệt qua từng Label để vẽ (Giống logic Python)
    for i = 1:length(CUSTOM_LABELS)
        label_name = CUSTOM_LABELS{i};
        
        % Kiểm tra xem label này có phải là tên cột trong bảng không
        if ismember(label_name, df_diversity.Properties.VariableNames)
            
            % Lấy dữ liệu
            x_data = df_diversity.generation;
            y_data = df_diversity.(label_name); % Truy cập cột bằng tên string
            
            % Lấy style
            mk = markers{mod(marker_idx-1, length(markers)) + 1};
            ls = linestyles{mod(linestyle_idx-1, length(linestyles)) + 1};
            clr = tab10_colors(mod(color_idx-1, size(tab10_colors, 1)) + 1, :);
            
            % Vẽ plot
            plot(x_data, y_data, ...
                'DisplayName', label_name, ...
                'Marker', mk, ...
                'LineStyle', ls, ...
                'Color', clr, ...
                'LineWidth', 1.5, ...
                'MarkerSize', 6);
                
            % Tăng index (chỉ tăng khi vẽ thành công, khớp với logic Python)
            marker_idx = marker_idx + 1;
            linestyle_idx = linestyle_idx + 1;
            color_idx = color_idx + 1;
        else
            warning('Cột "%s" không tìm thấy trong dữ liệu. Bỏ qua.', label_name);
        end
    end
    
    % =========================================================================
    % 4. TRANG TRÍ VÀ LƯU FILE
    % =========================================================================
    
    title(ax, 'Population Diversity over Generations', 'FontSize', 12, 'FontWeight', 'bold');
    xlabel(ax, 'Generation', 'FontWeight', 'bold');
    ylabel(ax, 'Diversity');
    grid(ax, 'on');
    
    % Legend bên ngoài
    lgd = legend(ax, 'show');
    set(lgd, 'Location', 'northeastoutside');
    
    % Lưu file .fig
    output_fig = fullfile(output_folder, 'pop_diversity.fig');
    savefig(f, output_fig);
    
    % (Tùy chọn) Lưu file png
    % output_png = fullfile(output_folder, 'pop_diversity.png');
    % saveas(f, output_png);
    
    fprintf('Hoàn tất! Đã lưu file tại: %s\n', output_fig);
end