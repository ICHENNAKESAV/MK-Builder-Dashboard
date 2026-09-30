frappe.pages['nmr2'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'NMR Dashboard',
        single_column: true
    });

    // 1. Inject Custom CSS
    $(`
        <style>
            /* Filter Dropdowns CSS */
            .hover-dropdown { position: relative; display: inline-block; flex: 1; min-width: 150px; }
            .hover-dropdown label { font-size: 12px; font-weight: bold; margin-bottom: 4px; display: block; }
            .hover-dropdown-btn { 
                width: 100%; padding: 8px 12px; border: 1px solid #d1d8dd; 
                border-radius: 4px; background: #fff; cursor: pointer; 
                text-align: left; font-size: 13px; white-space: nowrap; 
                overflow: hidden; text-overflow: ellipsis; 
            }
            .hover-dropdown-menu { 
                display: none; position: absolute; top: calc(100% + 4px); left: 0; 
                background: #fff; border: 1px solid #d1d8dd; border-radius: 4px; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; 
                min-width: 100%; max-height: 250px; overflow-y: auto;
            }
            .hover-dropdown.show .hover-dropdown-menu { display: block; }
            .dropdown-item { 
                padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f3f3f3; 
                font-size: 13px; display: flex; align-items: center; gap: 8px;
            }
            .dropdown-item input[type="checkbox"] { pointer-events: none; margin: 0; }
            .dropdown-item:last-child { border-bottom: none; }
            .dropdown-item:hover { background: #f0f4f7; }
            .dropdown-item.selected-item { background: #e8f4fd; }

            /* Tabs CSS */
            .dashboard-tabs { display: flex; gap: 10px; margin-top: 20px; border-bottom: 2px solid #d1d8dd; }
            .tab-btn {
                background: none; border: none; padding: 10px 20px; font-size: 14px; font-weight: bold;
                color: #555; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px;
                transition: all 0.2s ease;
            }
            .tab-btn:hover { color: #1f272e; }
            .tab-btn.active { color: #3498db; border-bottom-color: #3498db; }
            .tab-content { display: none; padding-top: 20px; }
            .tab-content.active { display: block; }
            
            /* Chart Cards */
            .chart-card {
                flex: 1 1 48%; min-width: 400px; background: #fff; padding: 20px; 
                border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .chart-card.full-width { flex: 1 1 100%; }
            .chart-container { width: 100%; height: 400px; }

            /* Drilldown Table CSS */
            .drilldown-table-wrapper { overflow: auto; max-height: 60vh; border: 1px solid #d1d8dd; border-radius: 4px; }
            .drilldown-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .drilldown-table th { background: #f8f9fa; position: sticky; top: 0; padding: 10px; border-bottom: 2px solid #d1d8dd; text-align: left; }
            .drilldown-table td { padding: 8px 10px; border-bottom: 1px solid #e2e6e8; }
            .drilldown-table tbody tr:hover { background-color: #f4f5f6; }
        </style>
    `).appendTo(page.main);

    // 2. Build the HTML UI
    $(`
        <div style="background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 20px; display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end;">
            <div style="flex: 1; min-width: 130px;">
                <label style="font-size: 12px; font-weight: bold;">From Date</label>
                <input type="date" id="js-filter-from" class="form-control" style="height: 35px; font-size: 13px;">
            </div>
            <div style="flex: 1; min-width: 130px;">
                <label style="font-size: 12px; font-weight: bold;">To Date</label>
                <input type="date" id="js-filter-to" class="form-control" style="height: 35px; font-size: 13px;">
            </div>
            <div class="hover-dropdown" id="dd-project"><label>Project</label><div class="hover-dropdown-btn" data-default="All Projects">All Projects</div><div class="hover-dropdown-menu" id="menu-project"></div></div>
            <div class="hover-dropdown" id="dd-contractor"><label>Contractor</label><div class="hover-dropdown-btn" data-default="All Contractors">All Contractors</div><div class="hover-dropdown-menu" id="menu-contractor"></div></div>
            <div class="hover-dropdown" id="dd-area"><label>Required Area</label><div class="hover-dropdown-btn" data-default="All Areas">All Areas</div><div class="hover-dropdown-menu" id="menu-area"></div></div>
            <div class="hover-dropdown" id="dd-category"><label id="label-category">NMR Category</label><div class="hover-dropdown-btn" data-default="All Categories">All Categories</div><div class="hover-dropdown-menu" id="menu-category"></div></div>
            <div class="hover-dropdown" id="dd-work"><label>Nature of Work</label><div class="hover-dropdown-btn" data-default="All Work Types">All Work Types</div><div class="hover-dropdown-menu" id="menu-work"></div></div>
            <div><button id="js-filter-clear" class="btn btn-default" style="height: 35px; font-size: 13px;">Clear All</button></div>
        </div>

        <div class="dashboard-tabs">
            <button class="tab-btn active" data-target="tab-main">Master Report</button>
            <button class="tab-btn" data-target="tab-summary">Summary Report</button>
        </div>

        <!-- TAB 1: Master Report -->
        <div id="tab-main" class="tab-content active">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; padding-bottom: 20px;">
                <div class="chart-card"><div id="chart-amount" class="chart-container"></div></div>
                <div class="chart-card"><div id="chart-category" class="chart-container"></div></div>
                <div class="chart-card full-width"><div id="chart-hours" class="chart-container"></div></div>
            </div>
        </div>

        <!-- TAB 2: Summary Report (9 Charts) -->
        <div id="tab-summary" class="tab-content">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; padding-bottom: 20px;">
                <!-- Row 1 -->
                <div class="chart-card"><div id="chart-daily-manpower" class="chart-container"></div></div>
                <div class="chart-card"><div id="chart-daily-hours" class="chart-container"></div></div>
                <!-- Row 2 -->
                <div class="chart-card"><div id="chart-area-hours" class="chart-container"></div></div>
                <div class="chart-card"><div id="chart-area-allocation" class="chart-container"></div></div>
                <!-- Row 3 -->
                <div class="chart-card"><div id="chart-labor-distribution" class="chart-container"></div></div>
                <div class="chart-card"><div id="chart-manpower-contractor" class="chart-container"></div></div>
                <!-- Row 4 -->
                <div class="chart-card"><div id="chart-ot-share" class="chart-container"></div></div>
                <!-- Row 5 (Full Width Stacked) -->
                <div class="chart-card full-width"><div id="chart-area-contractor-stacked" class="chart-container"></div></div>
                <div class="chart-card full-width"><div id="chart-daily-category-stacked" class="chart-container"></div></div>
            </div>
        </div>
    `).appendTo(page.main);

    let chart_instances = [];
    let master_data_main = []; 
    let master_data_summary = [];
    let current_tab = 'tab-main'; 

    // 3. Fetch Data Simultaneously
    frappe.dom.freeze("Fetching Data...");
    let fetched_main = false, fetched_summary = false;

    frappe.call({
        method: 'dashboard.dashboard.page.nmr2.nmr2.get_nmr_worksheet_data',
        args: { filters: {} },
        callback: function(r) {
            if (r.message) master_data_main = r.message;
            fetched_main = true;
            check_and_init();
        }
    });

    frappe.call({
        method: 'dashboard.dashboard.page.nmr2.nmr2.get_nmr_daily_summary_report_data',
        args: { filters: {} },
        callback: function(r) {
            if (r.message && r.message.data) master_data_summary = r.message.data;
            fetched_summary = true;
            check_and_init();
        }
    });

    function check_and_init() {
        if (fetched_main && fetched_summary) {
            frappe.dom.unfreeze();
            populate_dropdowns(); 
            apply_js_filters();   
        }
    }

    // 4. Tab Switching
    $(page.main).on('click', '.tab-btn', function() {$('.tab-btn').removeClass('active');
        $('.tab-content').removeClass('active');$(this).addClass('active');
        current_tab = $(this).data('target');$('#' + current_tab).addClass('active');
        populate_dropdowns();
        setTimeout(() => { chart_instances.forEach(chart => chart.resize()); }, 50);
    });

    window.addEventListener('resize', function() { chart_instances.forEach(chart => chart.resize()); });

    // 5. Populate Dropdowns
    function populate_dropdowns() {
        let unique_contractors = [...new Set(master_data_main.map(d => d.contractor).filter(Boolean))].sort();
        let unique_projects = [...new Set(master_data_main.map(d => d.project).filter(Boolean))].sort();
        let unique_areas = [...new Set(master_data_main.map(d => d.required_area).filter(Boolean))].sort();
        let unique_categories = [...new Set(master_data_main.map(d => d.nmr_category).filter(Boolean))].sort();

        const build_menu = (items, selected_vals) => {
            let html = '';
            items.forEach(item => {
                let is_checked = selected_vals.includes(item) ? 'checked' : '';
                let sel_class = selected_vals.includes(item) ? 'selected-item' : '';
                html += `<div class="dropdown-item ${sel_class}" data-value="${item}"><input type="checkbox" ${is_checked}><span>${item}</span></div>`;
            });
            return html;
        };

        let get_sel = (id) => $(id + ' .hover-dropdown-btn').data('selected-values') || [];

        $('#menu-contractor').html(build_menu(unique_contractors, get_sel('#dd-contractor')));
        $('#menu-project').html(build_menu(unique_projects, get_sel('#dd-project')));
        $('#menu-area').html(build_menu(unique_areas, get_sel('#dd-area')));
        $('#menu-category').html(build_menu(unique_categories, get_sel('#dd-category')));

        if (current_tab === 'tab-main') {
            $('#label-category').text('NMR Category'); 
            let unique_works = [...new Set(master_data_main.map(d => d.nature_of_work).filter(Boolean))].sort();
            $('#menu-work').html(build_menu(unique_works, get_sel('#dd-work')));
            $('#dd-work').show(); 
        } else {
            $('#label-category').text('Labor Category'); 
            $('#dd-work').hide(); 
        }
    }

    // 6. UI Interactions
    $(page.main).on('click', '.hover-dropdown-btn', function(e) {
        e.stopPropagation();
        let $parent = $(this).closest('.hover-dropdown');$('.hover-dropdown').not($parent).removeClass('show');$parent.toggleClass('show');
    });

    $(document).on('click', function() {$('.hover-dropdown').removeClass('show'); });

    $(page.main).on('click', '.dropdown-item', function(e) {
        e.stopPropagation(); 
        let $this =$(this);
        let $checkbox =$this.find('input[type="checkbox"]');
        let is_checked = !$checkbox.prop('checked');$checkbox.prop('checked', is_checked);
        
        if (is_checked) $this.addClass('selected-item');
        else $this.removeClass('selected-item');

        let $dropdown =$this.closest('.hover-dropdown');
        let $menu =$dropdown.find('.hover-dropdown-menu');
        let $btn =$dropdown.find('.hover-dropdown-btn');
        let selected_values = [];
        $menu.find('.selected-item').each(function() { selected_values.push($(this).attr('data-value')); });
        
        if (selected_values.length === 0) $btn.text($btn.attr('data-default'));
        else if (selected_values.length === 1) $btn.text($menu.find('.selected-item span').text().trim());
        else $btn.text(selected_values.length + ' Selected');$btn.data('selected-values', selected_values);
        apply_js_filters();
    });

    $('#js-filter-from, #js-filter-to').on('change', function() { apply_js_filters(); });

    $('#js-filter-clear').on('click', function() {
        $('#js-filter-from, #js-filter-to').val('');
        $('.dropdown-item').removeClass('selected-item');$('.dropdown-item input[type="checkbox"]').prop('checked', false);
        $('.hover-dropdown-btn').each(function() {$(this).text($(this).attr('data-default'));$(this).data('selected-values', []);
        });
        apply_js_filters();
    });

    // 7. Filtering Logic
    function apply_js_filters() {
        let f_from = $('#js-filter-from').val();
        let f_to = $('#js-filter-to').val();
        let sel_project = $('#dd-project .hover-dropdown-btn').data('selected-values') || [];
        let sel_contractor = $('#dd-contractor .hover-dropdown-btn').data('selected-values') || [];
        let sel_area = $('#dd-area .hover-dropdown-btn').data('selected-values') || [];
        let sel_category = $('#dd-category .hover-dropdown-btn').data('selected-values') || [];
        let sel_work = $('#dd-work .hover-dropdown-btn').data('selected-values') || [];

        const filter_logic = row => {
            if (f_from && row.date < f_from) return false;
            if (f_to && row.date > f_to) return false;
            if (sel_project.length > 0 && !sel_project.includes(row.project)) return false;
            if (sel_contractor.length > 0 && !sel_contractor.includes(row.contractor)) return false;
            if (sel_area.length > 0 && !sel_area.includes(row.required_area)) return false;
            if (sel_category.length > 0 && !sel_category.includes(row.nmr_category)) return false;
            if (row.nature_of_work !== undefined && sel_work.length > 0 && !sel_work.includes(row.nature_of_work)) return false;
            return true;
        };

        render_main_charts(master_data_main.filter(filter_logic));
        render_summary_charts(master_data_summary.filter(filter_logic));
    }

    // 8. General Chart Rendering & Drilldown Utilities
    function get_or_init_chart(dom_id) {
        let dom = document.getElementById(dom_id);
        let chart = echarts.getInstanceByDom(dom);
        if (!chart) {
            chart = echarts.init(dom);
            chart_instances.push(chart);
        }
        return chart;
    }

    function show_drilldown_dialog(title, columns, data) {
        let table_html = `<div class="drilldown-table-wrapper"><table class="drilldown-table"><thead><tr>`;
        columns.forEach(col => { table_html += `<th>${col.label}</th>`; });
        table_html += `</tr></thead><tbody>`;

        if(data.length === 0) {
            table_html += `<tr><td colspan="${columns.length}" style="text-align:center; padding:20px;">No Data Found</td></tr>`;
        } else {
            data.forEach(row => {
                table_html += `<tr>`;
                columns.forEach(col => {
                    let val = row[col.fieldname];
                    if(val === undefined || val === null) val = '-';
                    if (['total_amount', 'regular_amount', 'food_and_travel_expenses', 'total_hours', 'ot_hours', 'regular_hours', 'number_of_people'].includes(col.fieldname) && !isNaN(val) && val !== '-') {
                        val = flt(val).toFixed(2); 
                    }
                    table_html += `<td>${val}</td>`;
                });
                table_html += `</tr>`;
            });
        }
        table_html += `</tbody></table></div>`;

        let dialog = new frappe.ui.Dialog({ title: title, size: 'large', fields: [ { fieldtype: 'HTML', fieldname: 'table_html' } ] });
        dialog.fields_dict.table_html.$wrapper.html(table_html);
        dialog.show();
    }

    // ==========================================
    // TAB 1 CHARTS (Master Report) + DRILLDOWN
    // ==========================================
    function render_main_charts(data) {
        let by_contractor = {}; let by_category = {};

        data.forEach(row => {
            let contractor = row.contractor || 'Unknown';
            let category = row.nmr_category || 'Uncategorized';

            if (!by_contractor[contractor]) {
                by_contractor[contractor] = { total_amount: 0, regular_amount: 0, food_expense: 0, reg_hours: 0, ot_hours: 0 };
            }
            by_contractor[contractor].total_amount += flt(row.total_amount);
            by_contractor[contractor].regular_amount += flt(row.regular_amount);
            by_contractor[contractor].food_expense += flt(row.food_and_travel_expenses);
            by_contractor[contractor].reg_hours += flt(row.regular_hours);
            by_contractor[contractor].ot_hours += flt(row.ot_hours);

            if (!by_category[category]) by_category[category] = 0;
            by_category[category] += flt(row.total_hours);
        });

        const main_drilldown_cols = [
            {label: 'Date', fieldname: 'date'}, {label: 'Project', fieldname: 'project'},
            {label: 'Contractor', fieldname: 'contractor'}, {label: 'Area', fieldname: 'required_area'},
            {label: 'Category', fieldname: 'nmr_category'}, {label: 'Work Nature', fieldname: 'nature_of_work'},
            {label: 'Total Hours', fieldname: 'total_hours'}, {label: 'Total Amount', fieldname: 'total_amount'}
        ];

        // 1. Amount Breakdown
        let chart1 = get_or_init_chart('chart-amount');
        let contractors = Object.keys(by_contractor);
        chart1.setOption({
            title: { text: 'Amount Breakdown by Contractor', left: 'center' },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { top: 'bottom' },
            grid: { left: '5%', right: '5%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: contractors, axisLabel: { rotate: 30 } },
            yAxis: { type: 'value', name: 'Amount (₹)' },
            series: [
                { name: 'Regular Amount', type: 'bar', stack: 'total', itemStyle: { color: '#3498db' }, data: contractors.map(c => by_contractor[c].regular_amount.toFixed(2)) },
                { name: 'Food & Expenses', type: 'bar', stack: 'total', itemStyle: { color: '#f1c40f', borderRadius: [4, 4, 0, 0] }, data: contractors.map(c => by_contractor[c].food_expense.toFixed(2)) },
                { name: 'Total Amount', type: 'line', itemStyle: { color: '#e74c3c' }, symbolSize: 8, data: contractors.map(c => by_contractor[c].total_amount.toFixed(2)) }
            ]
        }, true);
        
        chart1.off('click');
        chart1.on('click', function (params) {
            let contractor_name = params.name;
            let filtered = data.filter(d => (d.contractor || 'Unknown') === contractor_name);
            show_drilldown_dialog(`Amount Breakdown Details: ${contractor_name}`, main_drilldown_cols, filtered);
        });

        // 2. Category Pie
        let chart2 = get_or_init_chart('chart-category');
        chart2.setOption({
            title: { text: 'Total Hours by Category', left: 'center' },
            tooltip: { trigger: 'item', formatter: '{b}: {c} Hours ({d}%)' },
            legend: { top: 'bottom' },
            series: [{ type: 'pie', radius: ['40%', '70%'], data: Object.keys(by_category).map(k => ({ name: k, value: by_category[k].toFixed(2) })) }]
        }, true);

        chart2.off('click');
        chart2.on('click', function (params) {
            let category_name = params.name;
            let filtered = data.filter(d => (d.nmr_category || 'Uncategorized') === category_name);
            show_drilldown_dialog(`Category Details: ${category_name}`, main_drilldown_cols, filtered);
        });

        // 3. Regular vs OT Stacked
        let chart3 = get_or_init_chart('chart-hours');
        chart3.setOption({
            title: { text: 'Regular vs OT Hours', left: 'center' },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { top: 'bottom' },
            grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: contractors, axisLabel: { rotate: 15 } },
            yAxis: { type: 'value', name: 'Hours' },
            series: [
                { name: 'Regular', type: 'bar', stack: 'total', itemStyle: { color: '#2ecc71' }, data: contractors.map(c => by_contractor[c].reg_hours.toFixed(2)) },
                { name: 'OT', type: 'bar', stack: 'total', itemStyle: { color: '#e74c3c', borderRadius: [4, 4, 0, 0] }, data: contractors.map(c => by_contractor[c].ot_hours.toFixed(2)) }
            ]
        }, true);

        chart3.off('click');
        chart3.on('click', function (params) {
            let contractor_name = params.name;
            let filtered = data.filter(d => (d.contractor || 'Unknown') === contractor_name);
            show_drilldown_dialog(`Hours Details: ${contractor_name}`, main_drilldown_cols, filtered);
        });
    }

    // ==========================================
    // TAB 2 CHARTS (Summary Report) + DRILLDOWN
    // ==========================================
    function render_summary_charts(data) {
        let by_date = {}; 
        let by_date_hours = {}; 
        let by_area = {}; 
        let by_area_people = {};
        let by_category = {}; 
        let by_contractor_manpower = {}; 
        let by_contractor_ot = {};
        
        // For Advanced Stacked Charts
        let all_contractors = new Set();
        let all_categories = new Set();
        let by_area_contractor = {}; // Area -> Contractor -> Hours
        let by_date_category = {}; // Date -> Category -> People

        data.forEach(row => {
            let dt = row.date || 'Unknown';
            let area = row.required_area || 'Unassigned Area';
            let cat = row.nmr_category || 'Uncategorized';
            let contractor = row.contractor || 'Unknown';
            let people = flt(row.number_of_people);
            let total_hrs = flt(row.total_hours);
            let ot_hrs = flt(row.ot_hours);

            // 1 & 5. Dates
            if (!by_date[dt]) by_date[dt] = 0;
            by_date[dt] += people;
            
            if (!by_date_hours[dt]) by_date_hours[dt] = { total: 0, ot: 0 };
            by_date_hours[dt].total += total_hrs;
            by_date_hours[dt].ot += ot_hrs;

            // 2 & 7. Areas
            if (!by_area[area]) by_area[area] = 0;
            by_area[area] += total_hrs;

            if (!by_area_people[area]) by_area_people[area] = 0;
            by_area_people[area] += people;

            // 3. Categories
            if (!by_category[cat]) by_category[cat] = 0;
            by_category[cat] += total_hrs;

            // 4 & 6. Contractor OT & Manpower
            if (!by_contractor_ot[contractor]) by_contractor_ot[contractor] = 0;
            by_contractor_ot[contractor] += ot_hrs;

            if (!by_contractor_manpower[contractor]) by_contractor_manpower[contractor] = 0;
            by_contractor_manpower[contractor] += people;

            // 8. Area x Contractor (Stacked)
            all_contractors.add(contractor);
            if (!by_area_contractor[area]) by_area_contractor[area] = {};
            if (!by_area_contractor[area][contractor]) by_area_contractor[area][contractor] = 0;
            by_area_contractor[area][contractor] += total_hrs;

            // 9. Date x Category (Stacked)
            all_categories.add(cat);
            if (!by_date_category[dt]) by_date_category[dt] = {};
            if (!by_date_category[dt][cat]) by_date_category[dt][cat] = 0;
            by_date_category[dt][cat] += people;
        });

        const sum_cols = [
            {label: 'Date', fieldname: 'date'}, {label: 'Project', fieldname: 'project'},
            {label: 'Contractor', fieldname: 'contractor'}, {label: 'Area', fieldname: 'required_area'},
            {label: 'Category', fieldname: 'nmr_category'}, {label: 'People', fieldname: 'number_of_people'},
            {label: 'Total Hours', fieldname: 'total_hours'}, {label: 'OT Hours', fieldname: 'ot_hours'}
        ];

        // 1. Daily Manpower Trend (Line)
        let chart1 = get_or_init_chart('chart-daily-manpower');
        let sorted_dates = Object.keys(by_date).sort();
        chart1.setOption({
            title: { text: 'Daily Manpower Trend', left: 'center' }, tooltip: { trigger: 'axis' },
            grid: { left: '10%', right: '5%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: sorted_dates, boundaryGap: false }, yAxis: { type: 'value', name: 'People' },
            series: [{ name: 'People', type: 'line', smooth: true, areaStyle: {}, itemStyle: { color: '#9b59b6' }, data: sorted_dates.map(d => by_date[d]) }]
        }, true);
        chart1.off('click'); chart1.on('click', p => show_drilldown_dialog(`Date: ${p.name}`, sum_cols, data.filter(d => (d.date||'Unknown') === p.name)));

        // 2. Daily Hours Logged (Line/Bar)
        let chart2 = get_or_init_chart('chart-daily-hours');
        chart2.setOption({
            title: { text: 'Daily Hours (Total vs OT)', left: 'center' }, tooltip: { trigger: 'axis' }, legend: { top: 'bottom' },
            grid: { left: '10%', right: '5%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: sorted_dates }, yAxis: { type: 'value', name: 'Hours' },
            series: [
                { name: 'Total Hours', type: 'bar', itemStyle: { color: '#3498db' }, data: sorted_dates.map(d => by_date_hours[d].total.toFixed(2)) },
                { name: 'OT Hours', type: 'line', itemStyle: { color: '#e74c3c' }, data: sorted_dates.map(d => by_date_hours[d].ot.toFixed(2)) }
            ]
        }, true);
        chart2.off('click'); chart2.on('click', p => show_drilldown_dialog(`Hours on ${p.name}`, sum_cols, data.filter(d => (d.date||'Unknown') === p.name)));

        // 3. Total Hours by Area (Bar)
        let chart3 = get_or_init_chart('chart-area-hours');
        let areas = Object.keys(by_area).sort((a,b) => by_area[b] - by_area[a]);
        chart3.setOption({
            title: { text: 'Total Hours by Area', left: 'center' }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '5%', right: '5%', bottom: '25%', containLabel: true },
            xAxis: { type: 'category', data: areas, axisLabel: { rotate: 30 } }, yAxis: { type: 'value', name: 'Hours' },
            series: [{ name: 'Hours', type: 'bar', itemStyle: { color: '#34495e' }, data: areas.map(a => by_area[a].toFixed(2)) }]
        }, true);
        chart3.off('click'); chart3.on('click', p => show_drilldown_dialog(`Area: ${p.name}`, sum_cols, data.filter(d => (d.required_area||'Unassigned') === p.name)));

        // 4. Labor Allocation by Area (Pie)
        let chart4 = get_or_init_chart('chart-area-allocation');
        chart4.setOption({
            title: { text: 'Labor Allocation by Area', left: 'center' }, tooltip: { trigger: 'item', formatter: '{b}: {c} People ({d}%)' },
            legend: { top: 'bottom' },
            series: [{ type: 'pie', radius: ['40%', '70%'], data: areas.map(a => ({ name: a, value: by_area_people[a] })) }]
        }, true);
        chart4.off('click'); chart4.on('click', p => show_drilldown_dialog(`Labor in ${p.name}`, sum_cols, data.filter(d => (d.required_area||'Unassigned') === p.name)));

        // 5. Labor Distribution by Category (Bar)
        let chart5 = get_or_init_chart('chart-labor-distribution');
        let cats = Object.keys(by_category).sort((a,b) => by_category[b] - by_category[a]);
        chart5.setOption({
            title: { text: 'Labor Output by Category', left: 'center' }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '5%', right: '5%', bottom: '25%', containLabel: true },
            xAxis: { type: 'category', data: cats, axisLabel: { rotate: 30 } }, yAxis: { type: 'value', name: 'Hours' },
            series: [{ name: 'Hours', type: 'bar', itemStyle: { color: '#16a085' }, data: cats.map(c => by_category[c].toFixed(2)) }]
        }, true);
        chart5.off('click'); chart5.on('click', p => show_drilldown_dialog(`Category: ${p.name}`, sum_cols, data.filter(d => (d.nmr_category||'Uncat') === p.name)));

        // 6. Manpower by Contractor (Bar)
        let chart6 = get_or_init_chart('chart-manpower-contractor');
        let sorted_contractors = Object.keys(by_contractor_manpower).sort((a,b) => by_contractor_manpower[b] - by_contractor_manpower[a]);
        chart6.setOption({
            title: { text: 'Manpower by Contractor', left: 'center' }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '5%', right: '5%', bottom: '25%', containLabel: true },
            xAxis: { type: 'category', data: sorted_contractors, axisLabel: { rotate: 30 } }, yAxis: { type: 'value', name: 'People' },
            series: [{ name: 'People', type: 'bar', itemStyle: { color: '#f39c12' }, data: sorted_contractors.map(c => by_contractor_manpower[c]) }]
        }, true);
        chart6.off('click'); chart6.on('click', p => show_drilldown_dialog(`Contractor: ${p.name}`, sum_cols, data.filter(d => (d.contractor||'Unknown') === p.name)));

        // 7. Overtime Share by Contractor (Pie)
        let chart7 = get_or_init_chart('chart-ot-share');
        let ot_data = sorted_contractors.filter(k => by_contractor_ot[k] > 0).map(k => ({ name: k, value: by_contractor_ot[k].toFixed(2) }));
        chart7.setOption({
            title: { text: 'Overtime Share by Contractor', left: 'center' }, tooltip: { trigger: 'item', formatter: '{b}: {c} OT Hours ({d}%)' },
            legend: { top: 'bottom' }, series: [{ type: 'pie', radius: ['40%', '70%'], data: ot_data }]
        }, true);
        chart7.off('click'); chart7.on('click', p => show_drilldown_dialog(`OT for ${p.name}`, sum_cols, data.filter(d => (d.contractor||'Unknown') === p.name && flt(d.ot_hours) > 0)));

        // 8. Area Output by Contractor (Stacked Bar)
        let chart8 = get_or_init_chart('chart-area-contractor-stacked');
        let cont_arr = Array.from(all_contractors);
        let series_cont = cont_arr.map(c => {
            return { name: c, type: 'bar', stack: 'total', data: areas.map(a => (by_area_contractor[a][c] || 0).toFixed(2)) };
        });
        chart8.setOption({
            title: { text: 'Area Output by Contractor (Total Hours)', left: 'center' }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { top: 'bottom' }, grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: areas, axisLabel: { rotate: 15 } }, yAxis: { type: 'value', name: 'Hours' }, series: series_cont
        }, true);
        chart8.off('click'); chart8.on('click', p => show_drilldown_dialog(`Area: ${p.name}, Contractor: ${p.seriesName}`, sum_cols, data.filter(d => (d.required_area||'Unassigned') === p.name && (d.contractor||'Unknown') === p.seriesName)));

        // 9. Daily Output by Category (Stacked Bar)
        let chart9 = get_or_init_chart('chart-daily-category-stacked');
        let cat_arr = Array.from(all_categories);
        let series_cat = cat_arr.map(c => {
            return { name: c, type: 'bar', stack: 'total', data: sorted_dates.map(d => (by_date_category[d][c] || 0)) };
        });
        chart9.setOption({
            title: { text: 'Daily Labor Output by Category (People)', left: 'center' }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { top: 'bottom' }, grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: sorted_dates }, yAxis: { type: 'value', name: 'People' }, series: series_cat
        }, true);
        chart9.off('click'); chart9.on('click', p => show_drilldown_dialog(`Date: ${p.name}, Category: ${p.seriesName}`, sum_cols, data.filter(d => (d.date||'Unknown') === p.name && (d.nmr_category||'Uncat') === p.seriesName)));
    }
};