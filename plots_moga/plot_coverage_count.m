function plot_coverage_count()
    % =========================================================================
    % 1. CẤU HÌNH ĐƯỜNG DẪN VÀ BIẾN
    % =========================================================================
    
    data_base_path = 'D:\NCKH\vietnam-satellite-simulation\data';
    output_folder = 'D:\NCKH\vietnam-satellite-simulation\plots';
    
    % Tên folder chứa dữ liệu (Tương ứng với biến count_100_coverage trong Python)
    target_folder_name = 'count_100_coverage'; 
    
    if ~exist(output_folder, 'dir')
        mkdir(output_folder);
    end

    % Cấu hình Labels và Checkpoints
    CUSTOM_LABELS = {
        'NSGA-NC', 'NSGA-C50', 'NSGA-C60', 'NSGA-C70', 'NSGA-C80', ...
        'NSGA-C90', 'NSGA-C95', 'NSGA-C99', 'NSGA-C100', 'MOGA-WS'
    };
    
    % Style configuration
    markers = {'o', 's', '^', 'd', 'v'}; 
    linestyles = {'-', '--'};
    tab10_colors = [
        0.1216, 0.4667, 0.7059; 1.0000, 0.4980, 0.0549; 0.1725, 0.6275, 0.1725; 
        0.8392, 0.1529, 0.1569; 0.5804, 0.4039, 0.7412; 0.5490, 0.3373, 0.2941; 
        0.8902, 0.4667, 0.7608; 0.4980, 0.4980, 0.4980; 0.7373, 0.7412, 0.1333; 
        0.0902, 0.7451, 0.8118
    ];

    % Cấu hình cho 2 plot cần vẽ
    % Key: là tên đuôi của file (vd: count_100_coverage_pop.csv -> key là 'pop')
    plot_specs = struct();
    
    plot_specs(1).key = 'pop';
    plot_specs(1).title = 'Population Count of 100% Coverage';
    plot_specs(1).ylabel = 'Count of 100% Coverage';
    
    plot_specs(2).key = 'hof';
    plot_specs(2).title = 'Hall of Fame Count of 100% Coverage';
    plot_specs(2).ylabel = 'Count of 100% Coverage';

    % =========================================================================
    % 2. LOAD DỮ LIỆU
    % =========================================================================
    
    fprintf('Đang đọc dữ liệu từ folder: %s ...\n', target_folder_name);
    full_folder_path = fullfile(data_base_path, target_folder_name);
    files = dir(fullfile(full_folder_path, '*.csv'));
    
    % Map chứa dữ liệu: Key -> Table
    data_map = containers.Map;
    
    for i = 1:length(files)
        filename = files(i).name;
        filepath = fullfile(full_folder_path, filename);
        opts = detectImportOptions(filepath);
        opts.VariableNamingRule = 'preserve';
        df = readtable(filepath, opts);
        
        % Logic lấy key: xóa tiền tố "folder_name_"
        [~, key_raw, ~] = fileparts(filename);
        prefix = [target_folder_name, '_'];
        if startsWith(key_raw, prefix)
            key = extractAfter(key_raw, strlength(prefix));
        else
            key = key_raw;
        end
        
        data_map(key) = df;
    end
    fprintf('Đã load %d files vào bộ nhớ.\n', data_map.Count);

    % =========================================================================
    % 3. VẼ VÀ LƯU 2 FILE RIÊNG BIỆT
    % =========================================================================
    
    for p = 1:length(plot_specs)
        spec = plot_specs(p);
        current_key = spec.key;
        
        % Kiểm tra xem key (pop/hof) có tồn tại trong dữ liệu không
        if isKey(data_map, current_key)
            df = data_map(current_key);
            
            % Tạo Figure
            f = figure('Name', spec.title, 'Color', 'w', 'Position', [100, 100, 1000, 700]);
            ax = axes(f);
            hold(ax, 'on');
            
            marker_idx = 1; linestyle_idx = 1; color_idx = 1;
            
            % Duyệt qua các Label để vẽ line
            for i = 1:length(CUSTOM_LABELS)
                label_name = CUSTOM_LABELS{i};
                
                if ismember(label_name, df.Properties.VariableNames)
                    % Vẽ
                    plot(df.generation, df.(label_name), ...
                        'DisplayName', label_name, ...
                        'Marker', markers{mod(marker_idx-1, length(markers)) + 1}, ...
                        'LineStyle', linestyles{mod(linestyle_idx-1, length(linestyles)) + 1}, ...
                        'Color', tab10_colors(mod(color_idx-1, size(tab10_colors, 1)) + 1, :), ...
                        'LineWidth', 1.5, 'MarkerSize', 6);
                    
                    % Chỉ tăng index style khi vẽ thành công
                    marker_idx = marker_idx + 1;
                    linestyle_idx = linestyle_idx + 1;
                    color_idx = color_idx + 1;
                end
            end
            
            % Trang trí
            title(ax, [spec.title, ' over Generations'], 'FontSize', 12, 'FontWeight', 'bold');
            xlabel(ax, 'Generation', 'FontWeight', 'bold');
            ylabel(ax, spec.ylabel);
            grid(ax, 'on');
            
            % Legend bên ngoài
            lgd = legend(ax, 'show');
            set(lgd, 'Location', 'northeastoutside');
            
            % Lưu file
            file_name = [target_folder_name, '_', current_key, '.fig'];
            output_path = fullfile(output_folder, file_name);
            savefig(f, output_path);
            
            fprintf('Đã lưu plot "%s" tại: %s\n', current_key, output_path);
            
            % Đóng figure
            close(f);
            
        else
            warning('Không tìm thấy dữ liệu cho key "%s" (File tương ứng có thể bị thiếu).', current_key);
        end
    end
    
    fprintf('Hoàn tất quá trình vẽ!\n');
end