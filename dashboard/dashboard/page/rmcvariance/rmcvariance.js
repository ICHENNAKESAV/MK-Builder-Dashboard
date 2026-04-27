frappe.pages['rmcvariance'].on_page_load = function (wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'RMC Variance Dashboard',
        single_column: true
    });

    // Fullscreen cleanup (better scoped)
    $('<style>\
        .navbar, .page-head { display: none !important; }\
        .rmc-container { padding: 15px; }\
        .rmc-card { background: #fff; border-radius: 10px; padding: 15px; \
            box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 15px; }\
        .rmc-title { font-size: 18px; font-weight: 600; margin-bottom: 10px; }\
        .filter-row .form-control { border-radius: 8px; }\
        .chart-box { height: 380px; }\
    </style>').appendTo("head");

    $(page.body).html(`
        <div class="rmc-container">

            <!-- HEADER CARD -->
            <div class="rmc-card">
                <div class="rmc-title">RMC Dashboard</div>

                <!-- FILTERS -->
                <div class="row filter-row">
                    <div class="col-md-3 mb-2" id="from_date"></div>
                    <div class="col-md-3 mb-2" id="to_date"></div>
                    <div class="col-md-3 mb-2" id="warehouse"></div>
                    <div class="col-md-3 mb-2" id="rmc_grade"></div>
                </div>
            </div>

            <!-- CHART ROW 1 -->
            <div class="row">
                <div class="col-md-6">
                    <div class="rmc-card">
                        <div class="rmc-title">Quantity Comparison</div>
                        <div id="chart_qty" class="chart-box"></div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="rmc-card">
                        <div class="rmc-title">Cost Comparison</div>
                        <div id="chart_cost" class="chart-box"></div>
                    </div>
                </div>
            </div>

            <!-- CHART ROW 2 -->
            <div class="row">
                <div class="col-md-6">
                    <div class="rmc-card">
                        <div class="rmc-title">Cost Difference</div>
                        <div id="chart_cost_diff" class="chart-box"></div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="rmc-card">
                        <div class="rmc-title">Quantity Difference</div>
                        <div id="chart_qty_diff" class="chart-box"></div>
                    </div>
                </div>
            </div>

        </div>
    `);

    // ---------------- FILTERS ----------------
    let from_date = frappe.ui.form.make_control({
        parent: $('#from_date'),
        df: { fieldtype: 'Date', label: 'From Date' },
        render_input: true
    });

    let to_date = frappe.ui.form.make_control({
        parent: $('#to_date'),
        df: { fieldtype: 'Date', label: 'To Date' },
        render_input: true
    });

    let warehouse = frappe.ui.form.make_control({
        parent: $('#warehouse'),
        df: { fieldtype: 'Link', options: 'Warehouse', label: 'Warehouse' },
        render_input: true
    });

    let rmc_grade = frappe.ui.form.make_control({
        parent: $('#rmc_grade'),
        df: { fieldtype: 'Select', label: 'RMC Grade', options: '' },
        render_input: true
    });

    // Load grades
    frappe.call({
        method: "dashboard.dashboard.page.rmcvariance.rmcvariance.get_rmc_grades",
        callback: function (r) {
            let options = [''];
            (r.message || []).forEach(d => options.push(d.rmc_grade));
            rmc_grade.df.options = options.join("\n");
            rmc_grade.refresh();
        }
    });

    let charts = {};

    function set_loading(state = true) {
        $(".chart-box").css("opacity", state ? 0.4 : 1);
    }

    function load_data() {
        set_loading(true);

        frappe.call({
            method: "dashboard.dashboard.page.rmcvariance.rmcvariance.get_rmc_variance_report",
            args: {
                from_date: from_date.get_value(),
                to_date: to_date.get_value(),
                warehouse: warehouse.get_value(),
                rmc_grade: rmc_grade.get_value()
            },
            callback: function (r) {
                set_loading(false);
                if (r.message) render_all(r.message);
            }
        });
    }

    [from_date, to_date, warehouse, rmc_grade].forEach(f => f.df.onchange = load_data);

    load_data();

    // ---------------- FORMAT ----------------
    function format_number(value) {
        value = flt(value || 0);
        if (value >= 1000000) return (value / 1000000).toFixed(2) + "M";
        if (value >= 1000) return (value / 1000).toFixed(2) + "K";
        return value.toFixed(2);
    }

    // ---------------- GROUP ----------------
    function group_data(data) {

        let grouped = {};

        data.forEach(d => {
            let key = d.item_code;

            if (!grouped[key]) {
                grouped[key] = {
                    item_code: d.item_code,
                    uom: d.uom,
                    rate: d.rate,
                    est_qty: 0,
                    act_qty: 0,
                    est_cost: 0,
                    act_cost: 0
                };
            }

            grouped[key].est_qty += flt(d["Estimated Quantity"]);
            grouped[key].act_qty += flt(d["Actual Quantity"]);
            grouped[key].est_cost += flt(d["Estimated Cost"]);
            grouped[key].act_cost += flt(d["Actual Cost"]);
        });

        return Object.values(grouped);
    }

    // ---------------- DRILLDOWN (same logic, cleaner table wrapper) ----------------
    function show_drilldown(title, data) {

        const columns = [
            "item_code","uom","rate","est_qty","act_qty",
            "est_cost","act_cost","variance","est_rate","act_rate","rate_diff"
        ];

        let rows = data.map((row, i) => `
            <tr>
                <td>${i + 1}</td>
                ${columns.map(k => `<td>${row[k] ?? ''}</td>`).join('')}
            </tr>
        `).join('');

        let d = new frappe.ui.Dialog({
            title,
            size: 'extra-large',
            fields: [{ fieldtype: 'HTML', fieldname: 'table' }]
        });

        d.fields_dict.table.$wrapper.html(`
            <div style="max-height:600px; overflow:auto;">
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            ${columns.map(c => `<th>${c}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `);

        d.show();
    }

    // ---------------- RENDER ----------------
    function render_all(data) {

        let grouped = group_data(data);
        let items = grouped.map(d => d.item_code);

        function base_option(title, series) {
            return {
                title: { text: title },
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: items },
                yAxis: { type: 'value' },
                series
            };
        }

        charts.qty = charts.qty || echarts.init(document.getElementById('chart_qty'));
        charts.cost = charts.cost || echarts.init(document.getElementById('chart_cost'));
        charts.cost_diff = charts.cost_diff || echarts.init(document.getElementById('chart_cost_diff'));
        charts.qty_diff = charts.qty_diff || echarts.init(document.getElementById('chart_qty_diff'));

        charts.qty.setOption(base_option("Qty Comparison", [
            { name: "Estimated", type: "bar", data: grouped.map(d => d.est_qty) },
            { name: "Actual", type: "bar", data: grouped.map(d => d.act_qty) }
        ]));

        charts.cost.setOption(base_option("Cost Comparison", [
            { name: "Estimated", type: "bar", data: grouped.map(d => d.est_cost) },
            { name: "Actual", type: "bar", data: grouped.map(d => d.act_cost) }
        ]));

        charts.cost_diff.setOption(base_option("Cost Difference", [
            { name: "Diff", type: "bar", data: grouped.map(d => d.act_cost - d.est_cost) }
        ]));

        charts.qty_diff.setOption(base_option("Qty Difference", [
            { name: "Diff", type: "bar", data: grouped.map(d => d.act_qty - d.est_qty) }
        ]));

        charts.qty.off('click');
        charts.qty.on('click', () => show_drilldown("Qty Drilldown", grouped));
    }
};