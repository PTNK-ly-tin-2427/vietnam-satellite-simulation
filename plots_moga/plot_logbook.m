function plot_logbook()
    % =========================================================================
    % 1. CẤU HÌNH ĐƯỜNG DẪN VÀ BIẾN
    % =========================================================================
    
    data_base_path = 'D:\NCKH\vietnam-satellite-simulation\data';
    output_folder = 'D:\NCKH\vietnam-satellite-simulation\plots';
    
    % !!! BẠN HÃY ĐỔI TÊN NÀY CHO ĐÚNG VỚI FOLDER THỰC TẾ !!!
    target_folder_name = 'hof_logbook'; 
    
    if ~exist(output_folder, 'dir')
        mkdir(output_folder);
    end

    plot_metrics = {
        'coverage_mean', 'coverage_std', ...
        'altitude_mean', 'altitude_std', ...
        'costs_mean', 'costs_std'
    };

    CUSTOM_LABELS = {
        'NSGA-NC', 'NSGA-C50', 'NSGA-C60', 'NSGA-C70', 'NSGA-C80', ...
        'NSGA-C90', 'NSGA-C95', 'NSGA-C99', 'NSGA-C100', 'MOGA-WS'
    };
    
    CHECKPOINT_FILES = [0, 50, 60, 70, 80, 90, 95, 99, 100, 2016];
    
    % Style configuration
    markers = {'o', 's', '^', 'd', 'v'}; 
    linestyles = {'-', '--'};
    tab10_colors = [
        0.1216, 0.4667, 0.7059; 1.0000, 0.4980, 0.0549; 0.1725, 0.6275, 0.1725; 
        0.8392, 0.1529, 0.1569; 0.5804, 0.4039, 0.7412; 0.5490, 0.3373, 0.2941; 
        0.8902, 0.4667, 0.7608; 0.4980, 0.4980, 0.4980; 0.7373, 0.7412, 0.1333; 
        0.0902, 0.7451, 0.8118
    ];

    % =========================================================================
    % 2. LOAD DỮ LIỆU
    % =========================================================================
    
    fprintf('Đang đọc dữ liệu từ: %s ...\n', target_folder_name);
    full_folder_path = fullfile(data_base_path, target_folder_name);
    files = dir(fullfile(full_folder_path, '*.csv'));
    pop_logbook = containers.Map;
    
    for i = 1:length(files)
        filename = files(i).name;
        filepath = fullfile(full_folder_path, filename);
        opts = detectImportOptions(filepath);
        opts.VariableNamingRule = 'preserve';
        df = readtable(filepath, opts);
        
        [~, key_raw, ~] = fileparts(filename);
        prefix = [target_folder_name, '_'];
        if startsWith(key_raw, prefix)
            key = extractAfter(key_raw, strlength(prefix));
        else
            key = key_raw;
        end
        pop_logbook(key) = df;
    end
    fprintf('Đã load %d files.\n', pop_logbook.Count);

    % =========================================================================
    % 3. VẼ VÀ LƯU TỪNG FILE
    % =========================================================================
    
    % Duyệt qua từng metric
    for m_idx = 1:length(plot_metrics)
        metric = plot_metrics{m_idx};
        
        % Tạo Figure mới cho mỗi metric (Kích thước 800x600)
        f = figure('Name', metric, 'Color', 'w', 'Position', [100, 100, 800, 600]);
        % set(f, 'Visible', 'off'); % Bỏ comment dòng này nếu bạn không muốn cửa sổ bật lên màn hình
        
        ax = axes(f); % Tạo axes trên figure
        hold(ax, 'on');
        
        marker_idx = 1; linestyle_idx = 1; color_idx = 1;
        
        for k = 1:length(CHECKPOINT_FILES)
            key_val = CHECKPOINT_FILES(k);
            key_str = num2str(key_val);
            label_str = CUSTOM_LABELS{k};
            
            if isKey(pop_logbook, key_str)
                df = pop_logbook(key_str);
                if ismember(metric, df.Properties.VariableNames)
                    plot(df.generation, df.(metric), ...
                        'DisplayName', label_str, ...
                        'Marker', markers{mod(marker_idx-1, length(markers)) + 1}, ...
                        'LineStyle', linestyles{mod(linestyle_idx-1, length(linestyles)) + 1}, ...
                        'Color', tab10_colors(mod(color_idx-1, size(tab10_colors, 1)) + 1, :), ...
                        'LineWidth', 1.5, 'MarkerSize', 6);
                end
            end
            marker_idx = marker_idx + 1;
            linestyle_idx = linestyle_idx + 1;
            color_idx = color_idx + 1;
        end
        
        % Trang trí
        title_str = strrep(metric, '_', ' ');
        title_str = [upper(title_str(1)), title_str(2:end)];
        
        title(ax, [title_str, ' Over Generations'], 'Interpreter', 'none', 'FontSize', 12, 'FontWeight', 'bold');
        xlabel(ax, 'Generation', 'FontWeight', 'bold');
        ylabel(ax, title_str, 'Interpreter', 'none');
        grid(ax, 'on');
        
        % Legend để bên ngoài
        lgd = legend(ax, 'show');
        set(lgd, 'Location', 'northeastoutside'); 
        
        % =====================================================================
        % LƯU FILE
        % =====================================================================
        
        % Tên file: TenFolder_TenMetric.fig
        % Ví dụ: pop_logbook_coverage_mean.fig
        file_base_name = [target_folder_name, '_', metric];
        
        output_fig = fullfile(output_folder, [file_base_name, '.fig']);
        
        % Lưu .fig
        savefig(f, output_fig);
        
        % (Tùy chọn) Lưu thêm .png cho tiện xem
        % output_png = fullfile(output_folder, [file_base_name, '.png']);
        % saveas(f, output_png);
        
        fprintf('Đã lưu: %s\n', output_fig);
        
        % Đóng figure để giải phóng bộ nhớ
        close(f);
    end
    
    fprintf('Hoàn tất! Kiểm tra folder: %s\n', output_folder);
end