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
                <div id="chart-nature-amount" class="chart-container"></div>
            </div>
        </div>

        <!-- TAB 2: Summary Report (8 Charts) -->
        <div id="tab-summary" class="tab-content">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; padding-bottom: 20px;">
                <!-- Row 1 -->
        <div class="chart-card">
            <div id="chart-daily-manpower" class="chart-container"></div>
        </div>

        <div class="chart-card">
            <div id="chart-daily-amount" class="chart-container"></div>
        </div>

        <!-- Row 2 -->
        <div class="chart-card">
            <div id="chart-project-manpower" class="chart-container"></div>
        </div>

        <div class="chart-card">
            <div id="chart-project-amount" class="chart-container"></div>
        </div>

        <!-- Row 3 -->
        <div class="chart-card">
            <div id="chart-category-manpower" class="chart-container"></div>
        </div>

        <div class="chart-card">
            <div id="chart-contractor-amount" class="chart-container"></div>
        </div>

        <!-- Row 4 -->
        <div class="chart-card">
            <div id="chart-area-amount" class="chart-container"></div>
        </div>

        <div class="chart-card">
            <div id="chart-category-amount" class="chart-container"></div>
        </div>
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

       // 2. Total Amount by Category (Pie Chart)
let amount_by_category = {};

data.forEach(row => {
    let category = row.nmr_category || 'Uncategorized';

    if (!amount_by_category[category]) {
        amount_by_category[category] = 0;
    }

    amount_by_category[category] += flt(row.total_amount);
});

let chart2 = get_or_init_chart('chart-category');

chart2.setOption({
    title: {
        text: 'Total Amount by Category',
        left: 'center'
    },
    tooltip: {
        trigger: 'item',
        formatter: function(params) {
            return params.name + ': ₹' +
                flt(params.value).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) +
                ' (' + params.percent + '%)';
        }
    },
    legend: {
        top: 'bottom',
        type: 'scroll'
    },
    series: [{
        name: 'Total Amount',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        label: {
            show: true,
            formatter: '{b}: {d}%'
        },
        data: Object.keys(amount_by_category).map(category => ({
            name: category,
            value: amount_by_category[category].toFixed(2)
        }))
    }]
}, true);

// Drill-down on pie slice click
chart2.off('click');

chart2.on('click', function(params) {
    let category_name = params.name;

    let filtered = data.filter(row =>
        (row.nmr_category || 'Uncategorized') === category_name
    );

    show_drilldown_dialog(
        `Total Amount Details: ${category_name}`,
        main_drilldown_cols,
        filtered
    );
});

        // 3. Total Amount by Nature of Work
let by_nature_of_work = {};

data.forEach(row => {
    let nature = row.nature_of_work || 'Unspecified';

    if (!by_nature_of_work[nature]) {
        by_nature_of_work[nature] = 0;
    }

    by_nature_of_work[nature] += flt(row.total_amount);
});

let chart3 = get_or_init_chart('chart-nature-amount');

let natures = Object.keys(by_nature_of_work).sort(
    (a, b) => by_nature_of_work[b] - by_nature_of_work[a]
);

chart3.setOption({
    title: {
        text: 'Total Amount by Nature of Work',
        left: 'center'
    },
    tooltip: {
        trigger: 'axis',
        axisPointer: {
            type: 'shadow'
        },
        valueFormatter: value =>
            '₹' + flt(value).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
    },
    grid: {
        left: '5%',
        right: '8%',
        bottom: '20%',
        containLabel: true
    },
    xAxis: {
        type: 'category',
        data: natures,
        axisLabel: {
            rotate: 25,
            interval: 0
        }
    },
    yAxis: {
        type: 'value',
        name: 'Total Amount (₹)',
        axisLabel: {
            formatter: value => '₹' + value.toLocaleString('en-IN')
        }
    },
    series: [{
        name: 'Total Amount',
        type: 'bar',
        itemStyle: {
            color: '#3498db',
            borderRadius: [5, 5, 0, 0]
        },
        label: {
            show: true,
            position: 'top',
            formatter: params =>
                '₹' + flt(params.value).toLocaleString('en-IN', {
                    maximumFractionDigits: 2
                })
        },
        data: natures.map(nature => ({
            value: by_nature_of_work[nature].toFixed(2),
            itemStyle: {
                color: '#3498db'
            }
        }))
    }]
}, true);

// Drill-down when a bar is clicked
chart3.off('click');

chart3.on('click', function(params) {
    let nature = params.name;

    let filtered = data.filter(row =>
        (row.nature_of_work || 'Unspecified') === nature
    );

    show_drilldown_dialog(
        `Total Amount Details: ${nature}`,
        main_drilldown_cols,
        filtered
    );
});
    }

    // ==========================================
// TAB 2: SUMMARY REPORT - 8 CHARTS
// Manpower + Total Amount Only
// ==========================================

function render_summary_charts(data) {

    let by_date_people = {};
    let by_date_amount = {};

    let by_project_people = {};
    let by_project_amount = {};

    let by_category_people = {};
    let by_category_amount = {};

    let by_contractor_amount = {};
    let by_area_amount = {};

    // ------------------------------------------
    // Aggregate data
    // ------------------------------------------

    data.forEach(row => {

        let date = row.date || 'Unknown';
        let project = row.project || 'Unknown Project';
        let category = row.nmr_category || 'Uncategorized';
        let contractor = row.contractor || 'Unknown Contractor';
        let area = row.required_area || 'Unassigned Area';

        let people = flt(row.number_of_people);
        let amount = flt(row.total_amount);

        // 1. Daily manpower
        by_date_people[date] =
            (by_date_people[date] || 0) + people;

        // 2. Daily amount
        by_date_amount[date] =
            (by_date_amount[date] || 0) + amount;

        // 3. Manpower by project
        by_project_people[project] =
            (by_project_people[project] || 0) + people;

        // 4. Amount by project
        by_project_amount[project] =
            (by_project_amount[project] || 0) + amount;

        // 5. Manpower by labor category
        by_category_people[category] =
            (by_category_people[category] || 0) + people;

        // 6. Amount by contractor
        by_contractor_amount[contractor] =
            (by_contractor_amount[contractor] || 0) + amount;

        // 7. Amount by required area
        by_area_amount[area] =
            (by_area_amount[area] || 0) + amount;

        // 8. Amount by labor category
        by_category_amount[category] =
            (by_category_amount[category] || 0) + amount;
    });

    // ------------------------------------------
    // Drilldown columns
    // ------------------------------------------

    const summary_cols = [
        { label: 'Date', fieldname: 'date' },
        { label: 'Project', fieldname: 'project' },
        { label: 'Required Area', fieldname: 'required_area' },
        { label: 'Contractor', fieldname: 'contractor' },
        { label: 'Labor Category', fieldname: 'nmr_category' },
        { label: 'People', fieldname: 'number_of_people' },
        { label: 'Total Amount', fieldname: 'total_amount' }
    ];

    // ------------------------------------------
    // Common helpers
    // ------------------------------------------

    function format_amount(value) {
        return '₹' + flt(value).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function sorted_entries(obj) {
        return Object.keys(obj)
            .map(name => ({
                name: name,
                value: obj[name]
            }))
            .sort((a, b) => b.value - a.value);
    }

    function show_group_details(title, field, value) {
        let filtered = data.filter(row => {
            let actual = row[field];

            if (!actual) {
                if (field === 'project') actual = 'Unknown Project';
                else if (field === 'nmr_category') actual = 'Uncategorized';
                else if (field === 'contractor') actual = 'Unknown Contractor';
                else if (field === 'required_area') actual = 'Unassigned Area';
                else if (field === 'date') actual = 'Unknown';
            }

            return actual === value;
        });

        show_drilldown_dialog(title, summary_cols, filtered);
    }

    function set_bar_chart(dom_id, title, entries, metric_name,
                           color, axis_name, fieldname, is_amount) {

        let chart = get_or_init_chart(dom_id);

        chart.setOption({
            title: {
                text: title,
                left: 'center'
            },

            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                valueFormatter: value =>
                    is_amount
                        ? format_amount(value)
                        : flt(value).toLocaleString('en-IN')
            },

            grid: {
                left: '5%',
                right: '8%',
                bottom: '20%',
                containLabel: true
            },

            xAxis: {
                type: 'category',
                data: entries.map(item => item.name),
                axisLabel: {
                    rotate: 25,
                    interval: 0
                }
            },

            yAxis: {
                type: 'value',
                name: axis_name,
                axisLabel: {
                    formatter: value =>
                        is_amount
                            ? '₹' + value.toLocaleString('en-IN')
                            : value
                }
            },

            series: [{
                name: metric_name,
                type: 'bar',
                barMaxWidth: 55,
                itemStyle: {
                    color: color,
                    borderRadius: [5, 5, 0, 0]
                },
                label: {
                    show: true,
                    position: 'top',
                    formatter: params =>
                        is_amount
                            ? format_amount(params.value)
                            : flt(params.value).toLocaleString('en-IN')
                },
                data: entries.map(item => item.value)
            }]

        }, true);

        chart.off('click');

        chart.on('click', function(params) {
            show_group_details(
                title + ': ' + params.name,
                fieldname,
                params.name
            );
        });
    }

    // ==========================================
    // CHART 1: DAILY MANPOWER TREND
    // ==========================================

    let dates = Object.keys(by_date_people).sort();

    let chart1 = get_or_init_chart('chart-daily-manpower');

    chart1.setOption({
        title: {
            text: 'Daily Manpower Trend',
            left: 'center'
        },

        tooltip: {
            trigger: 'axis'
        },

        grid: {
            left: '8%',
            right: '5%',
            bottom: '15%',
            containLabel: true
        },

        xAxis: {
            type: 'category',
            data: dates
        },

        yAxis: {
            type: 'value',
            name: 'People'
        },

        series: [{
            name: 'People',
            type: 'line',
            smooth: true,
            symbolSize: 7,
            areaStyle: {
                opacity: 0.2
            },
            itemStyle: {
                color: '#8e44ad'
            },
            data: dates.map(date => by_date_people[date])
        }]

    }, true);

    chart1.off('click');

    chart1.on('click', function(params) {
        show_group_details(
            'Daily Manpower: ' + params.name,
            'date',
            params.name
        );
    });

    // ==========================================
    // CHART 2: DAILY TOTAL AMOUNT
    // ==========================================

    let chart2 = get_or_init_chart('chart-daily-amount');

    chart2.setOption({
        title: {
            text: 'Daily Total Amount',
            left: 'center'
        },

        tooltip: {
            trigger: 'axis',
            valueFormatter: value => format_amount(value)
        },

        grid: {
            left: '8%',
            right: '5%',
            bottom: '15%',
            containLabel: true
        },

        xAxis: {
            type: 'category',
            data: dates
        },

        yAxis: {
            type: 'value',
            name: 'Amount (₹)',
            axisLabel: {
                formatter: value =>
                    '₹' + value.toLocaleString('en-IN')
            }
        },

        series: [{
            name: 'Total Amount',
            type: 'line',
            smooth: true,
            symbolSize: 7,
            areaStyle: {
                opacity: 0.15
            },
            itemStyle: {
                color: '#e67e22'
            },
            data: dates.map(date => by_date_amount[date])
        }]

    }, true);

    chart2.off('click');

    chart2.on('click', function(params) {
        show_group_details(
            'Daily Amount: ' + params.name,
            'date',
            params.name
        );
    });

    // ==========================================
    // CHART 3: MANPOWER BY PROJECT
    // ==========================================

    set_bar_chart(
        'chart-project-manpower',
        'Manpower by Project',
        sorted_entries(by_project_people),
        'People',
        '#3498db',
        'People',
        'project',
        false
    );

    // ==========================================
    // CHART 4: TOTAL AMOUNT BY PROJECT
    // ==========================================

    set_bar_chart(
        'chart-project-amount',
        'Total Amount by Project',
        sorted_entries(by_project_amount),
        'Total Amount',
        '#16a085',
        'Amount (₹)',
        'project',
        true
    );

    // ==========================================
    // CHART 5: MANPOWER BY LABOR CATEGORY
    // ==========================================

    set_bar_chart(
        'chart-category-manpower',
        'Manpower by Labor Category',
        sorted_entries(by_category_people),
        'People',
        '#9b59b6',
        'People',
        'nmr_category',
        false
    );

    // ==========================================
    // CHART 6: TOTAL AMOUNT BY CONTRACTOR
    // ==========================================

    set_bar_chart(
        'chart-contractor-amount',
        'Total Amount by Contractor',
        sorted_entries(by_contractor_amount),
        'Total Amount',
        '#e74c3c',
        'Amount (₹)',
        'contractor',
        true
    );

    // ==========================================
    // CHART 7: TOTAL AMOUNT BY REQUIRED AREA
    // ==========================================

    set_bar_chart(
        'chart-area-amount',
        'Total Amount by Required Area',
        sorted_entries(by_area_amount),
        'Total Amount',
        '#34495e',
        'Amount (₹)',
        'required_area',
        true
    );

    // ==========================================
    // CHART 8: TOTAL AMOUNT BY LABOR CATEGORY
    // ==========================================

    let category_amount_entries =
        sorted_entries(by_category_amount);

    let chart8 = get_or_init_chart('chart-category-amount');

    chart8.setOption({
        title: {
            text: 'Total Amount by Labor Category',
            left: 'center'
        },

        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                return params.name +
                    '<br>Total Amount: ' + format_amount(params.value) +
                    '<br>Share: ' + params.percent + '%';
            }
        },

        legend: {
            top: 'bottom',
            type: 'scroll'
        },

        series: [{
            name: 'Total Amount',
            type: 'pie',
            radius: ['40%', '68%'],
            avoidLabelOverlap: true,

            label: {
                show: true,
                formatter: '{b}: {d}%'
            },

            data: category_amount_entries.map(item => ({
                name: item.name,
                value: item.value
            }))
        }]

    }, true);

    chart8.off('click');

    chart8.on('click', function(params) {
        show_group_details(
            'Total Amount by Labor Category: ' + params.name,
            'nmr_category',
            params.name
        );
    });
}
};