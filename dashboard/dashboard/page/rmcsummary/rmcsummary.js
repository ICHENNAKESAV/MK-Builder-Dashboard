frappe.pages['rmcsummary'].on_page_load = function (wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        single_column: true
    });

    $(wrapper).css({
        padding: "15px",
        background: "#f4f6fb"
    });

    $(wrapper).find('.page-head').hide();
    $('.navbar').hide();

    // ================= UI =================
    $(page.body).html(`
		<h3>RMC Summary Dashboard</h3>
        <div style="
            display:flex;
            gap:12px;
            flex-wrap:wrap;
            margin-bottom:15px;
            background:white;
            padding:12px;
            border-radius:12px;
            box-shadow:0 2px 10px rgba(0,0,0,0.05);
            align-items:end;
        ">

            <div style="display:flex;flex-direction:column;">
                <label style="font-size:12px;color:#666;margin-bottom:4px;">From Date</label>
                <input type="date" id="from_date" class="form-control" style="width:180px;border-radius:8px;">
            </div>

            <div style="display:flex;flex-direction:column;">
                <label style="font-size:12px;color:#666;margin-bottom:4px;">To Date</label>
                <input type="date" id="to_date" class="form-control" style="width:180px;border-radius:8px;">
            </div>

            <div style="display:flex;flex-direction:column;">
                <label style="font-size:12px;color:#666;margin-bottom:4px;">Warehouse</label>
                <select id="warehouse" class="form-control" style="width:200px;border-radius:8px;">
                    <option value="">All Warehouses</option>
                </select>
            </div>

            <div style="display:flex;flex-direction:column;">
                <label style="font-size:12px;color:#666;margin-bottom:4px;">RMC Grade</label>
                <select id="rmc_grade" class="form-control" style="width:200px;border-radius:8px;">
                    <option value="">All Grades</option>
                </select>
            </div>

            <button id="reset_filters" class="btn btn-primary btn-sm"
                style="height:38px;border-radius:8px;">
                Reset
            </button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div id="chart_monthly" class="chart-card"></div>
            <div id="chart_grade_qty_cost" class="chart-card"></div>
            <div id="chart_warehouse" class="chart-card"></div>
            <div id="chart_mix_raw" class="chart-card"></div>
        </div>

        <!-- POPUP DRILLDOWN -->
        <div id="drilldown_modal" style="
            display:none;
            position:fixed;
            top:0;
            left:0;
            width:100%;
            height:100%;
            background:rgba(0,0,0,0.5);
            z-index:9999;
            align-items:center;
            justify-content:center;
        ">
            <div style="
                width:90%;
                height:85%;
                background:#fff;
                border-radius:14px;
                box-shadow:0 10px 40px rgba(0,0,0,0.3);
                overflow:hidden;
                display:flex;
                flex-direction:column;
            ">
                <div style="
                    padding:12px 15px;
                    border-bottom:1px solid #eee;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    font-weight:600;
                ">
                    <span id="drill_title"></span>
                    <button id="close_drill" style="
                        background:#ff4d4f;
                        color:#fff;
                        border:none;
                        padding:5px 10px;
                        border-radius:6px;
                        cursor:pointer;
                    ">Close</button>
                </div>

                <div id="drill_table" style="padding:10px;overflow:auto;height:100%;"></div>
            </div>
        </div>

        <style>
            .chart-card {
                height:420px;
                background:white;
                border-radius:14px;
                box-shadow:0 2px 12px rgba(0,0,0,0.06);
                padding:10px;
            }
        </style>
    `);

    bind_events();
    load_data();
    $(window).on("resize", resizeCharts);

    // close modal events
    $(document).on("click", "#close_drill", function () {
        $("#drilldown_modal").hide();
    });

    $(document).on("click", function (e) {
        if (e.target.id === "drilldown_modal") {
            $("#drilldown_modal").hide();
        }
    });
};


// ================= GLOBALS =================
let charts = {};
let global_data = [];
let filters_loaded = false;


// ================= EVENTS =================
function bind_events() {

    let timer = null;

    function reload() {
        clearTimeout(timer);
        timer = setTimeout(load_data, 250);
    }

    $("#from_date, #to_date").on("change", reload);
    $("#warehouse, #rmc_grade").on("change", reload);

    $("#reset_filters").on("click", function () {
        $("#from_date").val("");
        $("#to_date").val("");
        $("#warehouse").val("");
        $("#rmc_grade").val("");
        load_data();
    });
}


// ================= LOAD DATA =================
function load_data() {

    frappe.dom.freeze("Loading...");

    frappe.call({
        method: "dashboard.dashboard.page.rmcsummary.rmcsummary.get_rmc_production_summary",
        args: {
            from_date: $("#from_date").val(),
            to_date: $("#to_date").val(),
            destination_warehouse: $("#warehouse").val(),
            rmc_grade: $("#rmc_grade").val()
        },
        callback: function (r) {

            frappe.dom.unfreeze();

            global_data = r.message || [];

            if (!filters_loaded) {
                load_filter_options(global_data);
                filters_loaded = true;
            }

            render_monthly(global_data);
            render_grade_qty_cost(global_data);
            render_warehouse(global_data);
            render_mix_raw(global_data);
        }
    });
}


// ================= FILTERS =================
function load_filter_options(data) {

    let warehouses = new Set();
    let grades = new Set();

    data.forEach(d => {
        if (d["Destination Warehouse"]) warehouses.add(d["Destination Warehouse"]);
        if (d["RMC Grade"]) grades.add(d["RMC Grade"]);
    });

    $("#warehouse").html('<option value="">All Warehouses</option>');
    warehouses.forEach(w => $("#warehouse").append(`<option value="${w}">${w}</option>`));

    $("#rmc_grade").html('<option value="">All Grades</option>');
    grades.forEach(g => $("#rmc_grade").append(`<option value="${g}">${g}</option>`));
}


// ================= HELPERS =================
function getMonth(date) {
    if (!date) return "Unknown";

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let d = new Date(date);

    // IMPORTANT: include year to avoid merge
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
function resizeCharts() {
    Object.values(charts).forEach(c => c && c.resize());
}


// ================= DRILLDOWN =================
function open_drilldown(title, filterFn) {

    let filtered = global_data.filter(filterFn);

    let html = `
        <table class="table table-bordered">
            <thead style="position:sticky;top:0;background:#f5f6fa;">
                <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Grade</th>
                    <th>Warehouse</th>
                    <th>Total Qty</th>
                    <th>Mixing Rate</th>
                    <th>Total Mixing Cost</th>
                    <th>Total Raw Material Cost</th>
                    <th>Total Production Cost</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtered.forEach((d, i) => {
        html += `
            <tr>
                <td>${i + 1}</td>
                <td>${d.Date}</td>
                <td>${d["RMC Grade"]}</td>
                <td>${d["Destination Warehouse"]}</td>
                <td>${d["Total Quantity"]}</td>
                <td>${d["Mixing Rate"] || 0}</td>
                <td>${d["Total Mixing Cost"] || 0}</td>
                <td>${d["Total Raw Material Cost"] || 0}</td>
                <td>${d["Total Production Cost"] || 0}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;

    $("#drill_title").text(title);
    $("#drill_table").html(html);
    $("#drilldown_modal").css("display", "flex");
}


// ================= CHARTS =================
function render_monthly(data) {

    let map = {};

    data.forEach(d => {
        let m = getMonth(d.Date);
        if (!map[m]) map[m] = { qty: 0, cost: 0 };

        map[m].qty += d["Total Quantity"] || 0;
        map[m].cost += d["Total Production Cost"] || 0;
    });

    let months = Object.keys(map).sort((a, b) => {
    return new Date(a) - new Date(b);
});

    if (charts.monthly) charts.monthly.dispose();

    charts.monthly = echarts.init(document.getElementById("chart_monthly"));

    charts.monthly.setOption({
        title: { text: "Monthly Trend", left: "center" },
        tooltip: { trigger: "axis" },
        legend: { data: ["Qty", "Cost"] },
        xAxis: { type: "category", data: months },
        yAxis: { type: "value" },
        series: [
            { name: "Qty", type: "line", smooth: true, data: months.map(m => map[m].qty) },
            { name: "Cost", type: "line", smooth: true, data: months.map(m => map[m].cost) }
        ]
    });

    setTimeout(() => {
        charts.monthly.on("click", p =>
            open_drilldown("Monthly - " + p.name, d => getMonth(d.Date) === p.name)
        );
    }, 100);
}


// ================= GRADE =================
function render_grade_qty_cost(data) {

    let map = {};

    data.forEach(d => {
        let g = d["RMC Grade"] || "Unknown";
        if (!map[g]) map[g] = { qty: 0, cost: 0 };

        map[g].qty += d["Total Quantity"] || 0;
        map[g].cost += d["Total Production Cost"] || 0;
    });

    let grades = Object.keys(map);

    if (charts.grade) charts.grade.dispose();

    charts.grade = echarts.init(document.getElementById("chart_grade_qty_cost"));

    charts.grade.setOption({
        title: { text: "Grade Performance", left: "center" },
        tooltip: { trigger: "axis" },
        legend: { data: ["Qty", "Cost"] },
        xAxis: { type: "category", data: grades },
        yAxis: { type: "value" },
        series: [
            { name: "Qty", type: "bar", data: grades.map(g => map[g].qty) },
            { name: "Cost", type: "bar", data: grades.map(g => map[g].cost) }
        ]
    });

    setTimeout(() => {
        charts.grade.on("click", p =>
            open_drilldown("Grade - " + p.name, d => d["RMC Grade"] === p.name)
        );
    }, 100);
}


// ================= WAREHOUSE =================
function render_warehouse(data) {

    let map = {};

    data.forEach(d => {
        let w = d["Destination Warehouse"] || "Unknown";
        map[w] = (map[w] || 0) + (d["Total Quantity"] || 0);
    });

    let chartData = Object.keys(map).map(w => ({
        name: w,
        value: map[w]
    }));

    if (charts.warehouse) charts.warehouse.dispose();

    charts.warehouse = echarts.init(document.getElementById("chart_warehouse"));

    charts.warehouse.setOption({
        title: { text: "Warehouse Share", left: "center" },
        tooltip: { trigger: "item" },
        series: [{
            type: "pie",
            radius: "65%",
            data: chartData
        }]
    });

    setTimeout(() => {
        charts.warehouse.on("click", p =>
            open_drilldown("Warehouse - " + p.name, d => d["Destination Warehouse"] === p.name)
        );
    }, 100);
}


// ================= MIX COST =================
function render_mix_raw(data) {

    let map = {};

    data.forEach(d => {
        let g = d["RMC Grade"] || "Unknown";

        if (!map[g]) map[g] = { mix_cost: 0, raw_cost: 0 };

        map[g].mix_cost += d["Total Mixing Cost"] || 0;
        map[g].raw_cost += d["Total Raw Material Cost"] || 0;
    });

    let grades = Object.keys(map);

    if (charts.mix) charts.mix.dispose();

    charts.mix = echarts.init(document.getElementById("chart_mix_raw"));

    charts.mix.setOption({
        title: { text: "Cost Comparison", left: "center" },
        tooltip: { trigger: "axis" },
        legend: { data: ["Mixing Cost", "Raw Cost"] },
        xAxis: { type: "category", data: grades },
        yAxis: { type: "value" },
        series: [
            { name: "Mixing Cost", type: "bar", data: grades.map(g => map[g].mix_cost) },
            { name: "Raw Cost", type: "bar", data: grades.map(g => map[g].raw_cost) }
        ]
    });

    setTimeout(() => {
        charts.mix.on("click", p =>
            open_drilldown("Cost - " + p.name, d => d["RMC Grade"] === p.name)
        );
    }, 100);
}