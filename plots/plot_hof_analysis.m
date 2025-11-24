function plot_hof_analysis()
    % =========================================================================
    % 1. CẤU HÌNH ĐƯỜNG DẪN VÀ BIẾN
    % =========================================================================
    
    data_base_path = 'D:\NCKH\vietnam-satellite-simulation\data';
    output_folder = 'D:\NCKH\vietnam-satellite-simulation\plots';
    
    % Tên folder chứa dữ liệu hof_list
    target_folder_name = 'hof_list'; 
    
    % Các key cần vẽ (Tương ứng với tên file .csv trong folder trên)
    % Giả định file tên là: full.csv và 80-90-95.csv
    hof_list_keys_to_plot = {'hof_list_full', 'hof_list_80-90-95'}; 
    
    if ~exist(output_folder, 'dir')
        mkdir(output_folder);
    end

    % Cấu hình Labels và Checkpoints để map với cột 'case'
    CUSTOM_LABELS = {
        'NSGA-NC', 'NSGA-C50', 'NSGA-C60', 'NSGA-C70', 'NSGA-C80', ...
        'NSGA-C90', 'NSGA-C95', 'NSGA-C99', 'NSGA-C100', 'MOGA-WS'
    };
    
    CHECKPOINT_FILES = [0, 50, 60, 70, 80, 90, 95, 99, 100, 2016];
    
    % Tạo Map để tra cứu từ case (số) -> Label (tên)
    % Ví dụ: 50 -> 'NSGA-C50'
    label_map = containers.Map(CHECKPOINT_FILES, CUSTOM_LABELS);
    
    % Style configuration
    markers = {'o', 's', '^', 'd', 'v'}; 
    % Tab10 Colors
    tab10_colors = [
        0.1216, 0.4667, 0.7059; 1.0000, 0.4980, 0.0549; 0.1725, 0.6275, 0.1725; 
        0.8392, 0.1529, 0.1569; 0.5804, 0.4039, 0.7412; 0.5490, 0.3373, 0.2941; 
        0.8902, 0.4667, 0.7608; 0.4980, 0.4980, 0.4980; 0.7373, 0.7412, 0.1333; 
        0.0902, 0.7451, 0.8118
    ];

    % =========================================================================
    % 2. XỬ LÝ TỪNG KEY VÀ VẼ
    % =========================================================================
    
    for k = 1:length(hof_list_keys_to_plot)
        key = hof_list_keys_to_plot{k};
        
        % Đường dẫn file: data/hof_list/full.csv (hoặc 80-90-95.csv)
        % Lưu ý: Nếu file thực tế có tiền tố (vd: hof_list_full.csv), hãy sửa ở đây
        filename = [key, '.csv']; 
        filepath = fullfile(data_base_path, target_folder_name, filename);
        
        fprintf('Đang xử lý key "%s" (File: %s)...\n', key, filename);
        
        if exist(filepath, 'file')
            % Đọc dữ liệu
            opts = detectImportOptions(filepath);
            opts.VariableNamingRule = 'preserve';
            df = readtable(filepath, opts);
            
            % Kiểm tra các cột cần thiết
            required_cols = {'coverage', 'num_sats', 'altitude', 'case'};
            if all(ismember(required_cols, df.Properties.VariableNames))
                
                % Lọc: coverage == 1.0
                df_filtered = df(df.coverage == 1.0, :);
                
                if ~isempty(df_filtered)
                    % =========================================================
                    % VẼ PLOT
                    % =========================================================
                    f = figure('Name', ['HOF Analysis: ', key], 'Color', 'w', 'Position', [100, 100, 1000, 600]);
                    ax = axes(f);
                    hold(ax, 'on');
                    
                    % Lấy danh sách các case duy nhất và sắp xếp
                    unique_cases = unique(df_filtered.case);
                    unique_cases = sort(unique_cases);
                    
                    marker_idx = 1; color_idx = 1;
                    
                    for c_idx = 1:length(unique_cases)
                        case_val = unique_cases(c_idx);
                        
                        % Lọc dữ liệu theo từng case và sort theo num_sats
                        df_case = df_filtered(df_filtered.case == case_val, :);
                        df_case = sortrows(df_case, 'num_sats');
                        
                        % Tạo Label
                        if isKey(label_map, case_val)
                            label_prefix = label_map(case_val);
                        else
                            label_prefix = sprintf('Case %d', case_val);
                        end
                        plot_label = sprintf('%s (%s)', label_prefix, key);
                        
                        % Lấy Style
                        mk = markers{mod(marker_idx-1, length(markers)) + 1};
                        clr = tab10_colors(mod(color_idx-1, size(tab10_colors, 1)) + 1, :);
                        
                        % Vẽ (LineStyle = 'none' để chỉ hiện marker)
                        plot(df_case.num_sats, df_case.altitude, ...
                            'DisplayName', plot_label, ...
                            'Marker', mk, ...
                            'LineStyle', 'none', ... % Không nối dây
                            'Color', clr, ...
                            'MarkerFaceColor', 'none', ... % Rỗng ruột (giống alpha thấp)
                            'LineWidth', 1.5, ...
                            'MarkerSize', 8);
                        
                        marker_idx = marker_idx + 1;
                        color_idx = color_idx + 1;
                    end
                    
                    % Trang trí
                    title(ax, sprintf('100%% Coverage Solutions for "%s"', key), 'Interpreter', 'none', 'FontSize', 12, 'FontWeight', 'bold');
                    xlabel(ax, 'Costs (Number of Satellites)', 'FontWeight', 'bold');
                    ylabel(ax, 'Altitude', 'FontWeight', 'bold');
                    grid(ax, 'on');
                    
                    lgd = legend(ax, 'show');
                    set(lgd, 'Location', 'northeastoutside');
                    
                    % Lưu File .fig
                    % Tên file: hof_list_full.fig
                    output_filename = [target_folder_name, '_', key, '.fig'];
                    output_path = fullfile(output_folder, output_filename);
                    savefig(f, output_path);
                    
                    fprintf(' -> Đã lưu: %s\n', output_path);
                    close(f);
                    
                else
                    warning(' -> Không tìm thấy cá thể nào đạt 100%% coverage cho key "%s".', key);
                end
            else
                warning(' -> File thiếu cột bắt buộc (coverage, num_sats, altitude, case). Bỏ qua.');
            end
        else
            warning(' -> Không tìm thấy file: %s', filepath);
        end
    end
    
    fprintf('Hoàn tất!\n');
end