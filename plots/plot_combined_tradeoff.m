function plot_combined_tradeoff()
    % =========================================================================
    % 1. CẤU HÌNH ĐƯỜNG DẪN VÀ BIẾN
    % =========================================================================
    
    data_base_path = 'D:\NCKH\vietnam-satellite-simulation\data';
    output_folder = 'D:\NCKH\vietnam-satellite-simulation\plots';
    
    % Tên folder chứa dữ liệu hof history
    target_folder_name = 'hof_history'; 
    
    if ~exist(output_folder, 'dir')
        mkdir(output_folder);
    end

    % Cấu hình Labels và Checkpoints (Map 1-1)
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
    % 2. KHỞI TẠO PLOT
    % =========================================================================
    
    f = figure('Name', 'Trade-off HOF', 'Color', 'w', 'Position', [100, 100, 1000, 800]);
    ax = axes(f);
    hold(ax, 'on');
    
    full_folder_path = fullfile(data_base_path, target_folder_name);
    if ~exist(full_folder_path, 'dir')
        error('Không tìm thấy folder dữ liệu: %s', full_folder_path);
    end
    
    % Lấy danh sách tất cả file csv trong folder để tìm kiếm
    all_files = dir(fullfile(full_folder_path, '*.csv'));
    
    marker_idx = 1; linestyle_idx = 1; color_idx = 1;
    
    % =========================================================================
    % 3. DUYỆT QUA TỪNG CHECKPOINT VÀ VẼ
    % =========================================================================
    
    for k = 1:length(CHECKPOINT_FILES)
        cp_val = CHECKPOINT_FILES(k);
        cp_label = CUSTOM_LABELS{k};
        
        % --- Logic tìm file linh hoạt ---
        found_file = '';
        pat = ['(^|_)', num2str(cp_val), '(_|\.)']; 
        
        for f_idx = 1:length(all_files)
            if ~isempty(regexp(all_files(f_idx).name, pat, 'once'))
                found_file = all_files(f_idx).name;
                break;
            end
        end
        
        if isempty(found_file)
            possible_names = {[num2str(cp_val), '.csv'], ['hof_history_', num2str(cp_val), '.csv']};
            for pn = possible_names
                if exist(fullfile(full_folder_path, pn{1}), 'file')
                    found_file = pn{1};
                    break;
                end
            end
        end
        
        % --- Xử lý dữ liệu nếu tìm thấy file ---
        if ~isempty(found_file)
            filepath = fullfile(full_folder_path, found_file);
            
            opts = detectImportOptions(filepath);
            opts.VariableNamingRule = 'preserve';
            df = readtable(filepath, opts);
            
            required_cols = {'generation', 'coverage', 'num_sats', 'altitude'};
            if all(ismember(required_cols, df.Properties.VariableNames))
                
                df_last_gen = df(df.generation == 100, :);
                df_100 = df_last_gen(df_last_gen.coverage >= 1.0, :);
                
                if ~isempty(df_100)
                    df_sorted = sortrows(df_100, 'num_sats');
                    
                    mk = markers{mod(marker_idx-1, length(markers)) + 1};
                    ls = linestyles{mod(linestyle_idx-1, length(linestyles)) + 1};
                    clr = tab10_colors(mod(color_idx-1, size(tab10_colors, 1)) + 1, :);
                    
                    % --- SỬA LỖI Ở ĐÂY: Bỏ MarkerFaceAlpha ---
                    plot(df_sorted.num_sats, df_sorted.altitude, ...
                        'DisplayName', cp_label, ...
                        'Marker', mk, ...
                        'LineStyle', ls, ...
                        'Color', clr, ...
                        'LineWidth', 1.5, ...
                        'MarkerSize', 8, ...
                        'MarkerFaceColor', clr); % Marker đặc (không trong suốt)
                    
                end
            else
                warning('File %s thiếu cột dữ liệu cần thiết.', found_file);
            end
        else
            warning('Không tìm thấy file CSV cho checkpoint: %d', cp_val);
        end
        
        marker_idx = marker_idx + 1;
        linestyle_idx = linestyle_idx + 1;
        color_idx = color_idx + 1;
    end
    
    % =========================================================================
    % 4. TRANG TRÍ VÀ LƯU FILE
    % =========================================================================
    
    title(ax, 'Trade-off HOF: Orbit Altitude vs. Number of Satellites (100% Coverage)', ...
        'FontSize', 14, 'FontWeight', 'bold');
    xlabel(ax, 'Cost (Number of Satellites)', 'FontWeight', 'bold');
    ylabel(ax, 'Altitude (km)', 'FontWeight', 'bold');
    grid(ax, 'on');
    
    lgd = legend(ax, 'show');
    set(lgd, 'Location', 'northeastoutside');
    
    output_filename = 'all_combined_hof_100_coverage_tradeoff.fig';
    output_path = fullfile(output_folder, output_filename);
    savefig(f, output_path);
    
    fprintf('Đã lưu biểu đồ tại: %s\n', output_path);
end