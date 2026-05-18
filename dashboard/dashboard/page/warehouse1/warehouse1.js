frappe.pages['warehouse1'].on_page_load = function(wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Warehouse Dashboard',
        single_column: true
    });

    // =====================================================
    // LAYOUT
    // =====================================================

    $(page.body).html(`
        <div class="warehouse-dashboard">

            <!-- FILTERS -->
            <div class="row mb-3">

                <div class="col-md-3">
                    <div id="from-date"></div>
                </div>

                <div class="col-md-3">
                    <div id="to-date"></div>
                </div>

                <div class="col-md-3">
                    <div id="company"></div>
                </div>

            </div>

            <!-- CHARTS -->
            <div class="row">

                <div class="col-md-6">
                    <div class="card p-3 mb-4">
                        <h4>COGS Distribution</h4>
                        <div id="pie-chart" style="width:100%; height:450px;"></div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card p-3 mb-4">
                        <h4>COGS by Item Group</h4>
                        <div id="bar-chart" style="width:100%; height:450px;"></div>
                    </div>
                </div>

            </div>

            <!-- TABLE -->
            <div class="card p-3">
                <h4>COGS Table</h4>
                <div id="table-area"></div>
            </div>

        </div>
    `);

    // =====================================================
    // DEFAULT DATE (LAST 1 MONTH)
    // =====================================================

    function get_default_dates() {

        let to_date = frappe.datetime.get_today();

        let d = new Date(to_date);
        d.setMonth(d.getMonth() - 1);

        let from_date = frappe.datetime.obj_to_str(d);

        return { from_date, to_date };
    }

    const defaults = get_default_dates();

    // =====================================================
    // FILTER CONTROLS
    // =====================================================

    const from_date = frappe.ui.form.make_control({
        parent: $("#from-date"),
        df: {
            label: "From Date",
            fieldtype: "Date",
            default: defaults.from_date,
            change: debounce_load
        },
        render_input: true
    });

    from_date.refresh();
    from_date.set_value(defaults.from_date);

    const to_date = frappe.ui.form.make_control({
        parent: $("#to-date"),
        df: {
            label: "To Date",
            fieldtype: "Date",
            default: defaults.to_date,
            change: debounce_load
        },
        render_input: true
    });

    to_date.refresh();
    to_date.set_value(defaults.to_date);

    const company = frappe.ui.form.make_control({
        parent: $("#company"),
        df: {
            label: "Company",
            fieldtype: "Link",
            options: "Company",
            default: frappe.defaults.get_default("Company"),
            change: debounce_load
        },
        render_input: true
    });

    company.refresh();
    company.set_value(frappe.defaults.get_default("Company"));

    // =====================================================
    // CHARTS
    // =====================================================

    let pie_chart = echarts.init(document.getElementById('pie-chart'));
    let bar_chart = echarts.init(document.getElementById('bar-chart'));

    setTimeout(() => {
        pie_chart.resize();
        bar_chart.resize();
    }, 300);

    // =====================================================
    // INITIAL LOAD
    // =====================================================

    load_dashboard();

    // =====================================================
    // DEBOUNCE (IMPORTANT FOR FILTER CHANGE)
    // =====================================================

    let timer = null;

    function debounce_load() {

        clearTimeout(timer);

        timer = setTimeout(() => {
            load_dashboard();
        }, 300);
    }

    // =====================================================
    // LOAD DATA
    // =====================================================

    function load_dashboard() {

        frappe.call({
            method: "dashboard.dashboard.page.warehouse1.warehouse1.get_cogs_data",
            args: {
                from_date: from_date.get_value(),
                to_date: to_date.get_value(),
                company: company.get_value()
            },
            callback: function(r) {

                const data = r.message || [];

                render_table(data);
                render_pie_chart(data);
                render_bar_chart(data);
            }
        });
    }

    // =====================================================
    // DATA FORMATTER
    // =====================================================

    function get_chart_data(data) {

        return {
            labels: data.map(d => d.item_group),
            values: data.map(d => d.cogs),
            pie: data.map(d => ({
                name: d.item_group,
                value: d.cogs
            }))
        };
    }

    // =====================================================
    // PIE CHART
    // =====================================================

    function render_pie_chart(data) {

        const chart_data = get_chart_data(data);

        pie_chart.setOption({

            tooltip: { trigger: 'item' },

            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                data: chart_data.pie,

                label: {
                    formatter: p => `${p.name}\n${p.value.toFixed(2)}`
                }
            }]
        });

        setTimeout(() => pie_chart.resize(), 50);
    }

    // =====================================================
    // BAR CHART
    // =====================================================

    function render_bar_chart(data) {

        const chart_data = get_chart_data(data);

        bar_chart.setOption({

            tooltip: { trigger: 'axis' },

            xAxis: {
                type: 'category',
                data: chart_data.labels,
                axisLabel: { rotate: 0 }
            },

            yAxis: { type: 'value' },

            series: [{
                type: 'bar',
                data: chart_data.values,

                label: {
                    show: true,
                    position: 'top',
                    formatter: p => p.value.toFixed(2)
                },

                itemStyle: {
                    color: '#5E64FF'
                }
            }]
        });

        setTimeout(() => bar_chart.resize(), 50);
    }

    // =====================================================
    // TABLE
    // =====================================================

    function render_table(data) {

        let html = `
            <table class="table table-bordered table-hover">
                <thead>
                    <tr>
                        <th>Item Group</th>
                        <th style="text-align:right;">COGS</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(row => {

            html += `
                <tr>
                    <td>${row.item_group}</td>
                    <td style="text-align:right;">
                        ${format_currency(row.cogs)}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;

        $('#table-area').html(html);
    }

    // =====================================================
    // RESPONSIVE FIX
    // =====================================================

    window.addEventListener('resize', function() {
        pie_chart.resize();
        bar_chart.resize();
    });

};