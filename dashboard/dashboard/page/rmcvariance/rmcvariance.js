frappe.pages['rmcvariance'].on_page_load = function (wrapper) {

    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'RMC Variance Dashboard',
        single_column: true
    });

    // FULL SCREEN
    $("<style>\
    .navbar, .page-head { display: none !important; }\
    </style>").appendTo("head");

    // LAYOUT
    $(page.body).html(`
        <h3>RMC Dashboard</h3>
        <div class="container-fluid">

            <div class="row mb-3">
                <div class="col-md-3" id="from_date"></div>
                <div class="col-md-3" id="to_date"></div>
                <div class="col-md-3" id="warehouse"></div>
                <div class="col-md-3" id="rmc_grade"></div>
            </div>

            <div class="row">
                <div class="col-md-6"><div id="chart_qty" style="height:400px;"></div></div>
                <div class="col-md-6"><div id="chart_cost" style="height:400px;"></div></div>
            </div>

            <div class="row mt-3">
                <div class="col-md-6"><div id="chart_cost_diff" style="height:400px;"></div></div>
                <div class="col-md-6"><div id="chart_qty_diff" style="height:400px;"></div></div>
            </div>

        </div>
    `);

    // FILTERS
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

    // LOAD RMC GRADES
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

    function load_data() {
        frappe.call({
            method: "dashboard.dashboard.page.rmcvariance.rmcvariance.get_rmc_variance_report",
            args: {
                from_date: from_date.get_value(),
                to_date: to_date.get_value(),
                warehouse: warehouse.get_value(),
                rmc_grade: rmc_grade.get_value()
            },
            callback: function (r) {
                if (r.message) render_all(r.message);
            }
        });
    }

    [from_date, to_date, warehouse, rmc_grade].forEach(f => f.df.onchange = load_data);

    load_data();

    // FORMAT
    function format_number(value) {
        value = flt(value || 0);
        if (value >= 1000000) return (value / 1000000).toFixed(2) + "M";
        if (value >= 1000) return (value / 1000).toFixed(2) + "K";
        return value.toFixed(2);
    }

    // GROUP DATA
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

        Object.values(grouped).forEach(d => {
            d.qty_diff = d.act_qty - d.est_qty;

            d.variance = d.est_qty > 0
                ? ((d.qty_diff / d.est_qty) * 100)
                : 0;

            d.est_rate = d.est_qty > 0 ? d.est_cost / d.est_qty : 0;
            d.act_rate = d.act_qty > 0 ? d.act_cost / d.act_qty : 0;

            d.rate_diff = d.act_rate - d.est_rate;
        });

        return Object.values(grouped);
    }

    // DRILLDOWN
    function show_drilldown(title, data) {

        const columns = [
            { key: "item_code", label: "Item Code" },
            { key: "uom", label: "UOM" },
            { key: "rate", label: "Base Rate" },
            { key: "est_qty", label: "Estimated Qty" },
            { key: "act_qty", label: "Actual Qty" },
            { key: "est_cost", label: "Estimated Cost" },
            { key: "act_cost", label: "Actual Cost" },
            { key: "variance", label: "Variance %" },
            { key: "est_rate", label: "Estimated Rate" },
            { key: "act_rate", label: "Actual Rate" },
            { key: "rate_diff", label: "Rate Difference" }
        ];

        let header = columns.map(c => `<th>${c.label}</th>`).join("");

        let rows = data.map((row, i) => {

            let tds = columns.map(col => {

                let value = row[col.key];

                if (col.key === "variance") {
                    value = (value || 0).toFixed(2) + " %";
                } else if (typeof value === "number") {
                    value = format_number(value);
                }

                return `<td>${value ?? ""}</td>`;
            }).join("");

            return `<tr><td>${i + 1}</td>${tds}</tr>`;
        }).join("");

        let d = new frappe.ui.Dialog({
            title: title,
            size: 'extra-large',
            fields: [{ fieldtype: 'HTML', fieldname: 'table' }]
        });

        d.fields_dict.table.$wrapper.html(`
            <div style="overflow:auto; max-height:600px;">
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            ${header}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `);

        d.show();
    }

    // RENDER
    function render_all(data) {

        let grouped = group_data(data);
        let items = grouped.map(d => d.item_code);

        function base_option(title, series) {
            return {
                title: { text: title },
                tooltip: {
    trigger: 'axis',
    formatter: function (params) {

        let text = params[0].axisValue + "<br/>";

        params.forEach(p => {
            let value = flt(p.value || 0).toFixed(2);  // ✅ 2 decimals
            text += `${p.marker} ${p.seriesName}: ${value}<br/>`;
        });

        return text;
    }
},
                legend: {},
                xAxis: { type: 'category', data: items },
                yAxis: { type: 'value' },
                series: series.map(s => ({
                    ...s,
                    label: {
                        show: true,
                        position: 'inside',
                        formatter: p => format_number(p.value)
                    }
                }))
            };
        }

        // INIT ONLY ONCE
        charts.qty = charts.qty || echarts.init(document.getElementById('chart_qty'));
        charts.cost = charts.cost || echarts.init(document.getElementById('chart_cost'));
        charts.cost_diff = charts.cost_diff || echarts.init(document.getElementById('chart_cost_diff'));
        charts.qty_diff = charts.qty_diff || echarts.init(document.getElementById('chart_qty_diff'));

        // SET OPTIONS
        charts.qty.setOption(base_option("Qty Comparison", [
            { name: "Estimated", type: "bar", data: grouped.map(d => d.est_qty) },
            { name: "Actual", type: "bar", data: grouped.map(d => d.act_qty) }
        ]));

        charts.cost.setOption(base_option("Cost Comparison", [
            { name: "Estimated", type: "bar", data: grouped.map(d => d.est_cost) },
            { name: "Actual", type: "bar", data: grouped.map(d => d.act_cost) }
        ]));

        charts.cost_diff.setOption(base_option("Cost Difference", [
            { name: "Cost Diff", type: "bar", data: grouped.map(d => d.act_cost - d.est_cost) }
        ]));

        charts.qty_diff.setOption(base_option("Qty Difference", [
            { name: "Qty Diff", type: "bar", data: grouped.map(d => d.act_qty - d.est_qty) }
        ]));

        // 🔥 FIX: REMOVE OLD EVENTS BEFORE ADDING NEW
        charts.qty.off('click');
        charts.cost.off('click');
        charts.cost_diff.off('click');
        charts.qty_diff.off('click');

        charts.qty.on('click', () => show_drilldown("Qty Drilldown", grouped));
        charts.cost.on('click', () => show_drilldown("Cost Drilldown", grouped));
        charts.cost_diff.on('click', () => show_drilldown("Cost Diff Drilldown", grouped));
        charts.qty_diff.on('click', () => show_drilldown("Qty Diff Drilldown", grouped));
    }
};