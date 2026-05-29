frappe.pages['bricks2'].on_page_load = function(wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Bricks Dashboard',
        single_column: true
    });

    // Hide Frappe chrome ONLY when inside an iframe
    if (window.self !== window.top) {
        const style = document.createElement('style');
        style.innerHTML = `
            .navbar { display: none !important; }
            .page-head { display: none !important; }
            body { padding-top: 0 !important; }
            .page-container { padding: 0 !important; }
        `;
        document.head.appendChild(style);

        $(wrapper).css('padding', '0px');
        $(wrapper).find('.page-head').hide();
        $(page.body).parent().css('padding', '0px');
    }

    let today = frappe.datetime.get_today();

    let delivery_data   = [];
    let production_data = [];
    let material_data   = [];
    let summary_data    = [];

    let charts = {
        customer:   null,
        brickSize:  null,
        production: null,
        material:   null,
        summary:    null
    };

    let filters = {
        from_date:  "2025-12-09",
        to_date:    today,
        customer:   null,
        brick_size: null,
        company:    null
    };

    $(page.body).html(`
        <h2 style="padding:10px 15px;margin:0;font-size:18px;color:#2c3e50;">Bricks Dashboard</h2>
        <style>
            #dash-root { position: relative; min-height: 100vh; box-sizing: border-box; width: 100%; }
            .dash-grid { display: grid; grid-template-columns: 1fr; gap: 20px; padding: 15px; box-sizing: border-box; }
            @media(min-width:1200px) { .dash-grid { grid-template-columns: 1fr 1fr; } }
            .card-box { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); min-width: 0; }
            .title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #2c3e50; }

            .filter-bar {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                padding: 10px 15px;
                background: #f8f9fa;
                border-bottom: 1px solid #eee;
                align-items: center;
                box-sizing: border-box;
                width: 100%;
            }
            .filter-bar label { font-size: 11px; color: #666; margin-right: 2px; white-space: nowrap; }
            .filter-bar input,
            .filter-bar select {
                padding: 5px 8px;
                font-size: 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                min-width: 0;
                flex: 1 1 100px;
                max-width: 150px;
                box-sizing: border-box;
            }
            .filter-bar button {
                padding: 5px 12px;
                font-size: 12px;
                background: #e74c3c;
                color: #fff;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                white-space: nowrap;
                flex-shrink: 0;
            }

            /* Modal */
            .drill-modal {
                position: absolute;
                top: 0; left: 0;
                width: 100%;
                min-height: 100%;
                background: rgba(0,0,0,0.35);
                display: flex;
                align-items: flex-start;
                justify-content: center;
                z-index: 9999;
                padding-top: 60px;
                box-sizing: border-box;
            }
            .drill-box {
                width: 90%;
                max-width: 900px;
                max-height: 80vh;
                background: #fff;
                border-radius: 10px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .drill-header {
                padding: 10px 12px;
                font-size: 13px;
                font-weight: 600;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #eee;
                background: #f8f9fa;
                flex-shrink: 0;
            }
            .close-btn { border: none; background: transparent; cursor: pointer; font-size: 14px; color: #999; }
            .close-btn:hover { color: #333; }
            .drill-body { overflow: auto; padding: 10px; flex: 1; }
            .drill-body table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .drill-body th,
            .drill-body td { padding: 6px 8px; border-bottom: 1px solid #f2f2f2; white-space: nowrap; text-align: left; }
            .drill-body th { font-size: 11px; color: #666; text-transform: capitalize; background: #fafafa; position: sticky; top: 0; }
            .drill-body td:first-child,
            .drill-body th:first-child { text-align: center; color: #999; width: 40px; }
            .drill-body tr:hover td { background: #f9f9f9; }
            .no-data { text-align: center; color: #aaa; font-size: 12px; padding: 20px; }
        </style>

        <div id="dash-root">
            <div class="filter-bar">
                <label>From</label><input type="date" id="from_date">
                <label>To</label><input type="date" id="to_date">
                <label>Customer</label>
                <select id="customer_filter"><option value="">All Customers</option></select>
                <label>Brick Size</label>
                <select id="brick_filter"><option value="">All Brick Sizes</option></select>
                <label>Company</label>
                <select id="company_filter"><option value="">All Companies</option></select>
                <button id="clear_filters">&#10005; Clear</button>
            </div>

            <div class="dash-grid">
                <div class="card-box">
                    <div class="title">&#128230; Customer Delivery</div>
                    <div id="customerChart" style="height:380px;width:100%;"></div>
                </div>
                <div class="card-box">
                    <div class="title">&#129521; Brick Size Delivery</div>
                    <div id="brickSizeChart" style="height:380px;width:100%;"></div>
                </div>
                <div class="card-box">
                    <div class="title">&#127981; Production</div>
                    <div id="productionChart" style="height:380px;width:100%;"></div>
                </div>
                <div class="card-box">
                    <div class="title">&#129514; Raw Material</div>
                    <div id="materialChart" style="height:380px;width:100%;"></div>
                </div>
                <div class="card-box" style="grid-column:1/-1;">
                    <div class="title">&#128202; Production vs Sales Summary</div>
                    <div id="summaryChart" style="height:clamp(300px,40vw,500px);width:100%;"></div>
                </div>
            </div>
        </div>
    `);

    // =========================
    // NORMALIZE HELPERS
    // =========================
    function normalize_brick(v) {
        return String(v || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalize_delivery(rows) {
        return (rows || []).map(d => ({
            ...d,
            brick_size:    String(d.brick_size    || "").trim(),
            customer_name: String(d.customer_name || "").trim(),
            company:       String(d.company       || "").trim(),
            _brick_key:    normalize_brick(d.brick_size),
            _customer_key: String(d.customer_name || "").trim().toLowerCase(),
            _company_key:  String(d.company       || "").trim().toLowerCase()
        }));
    }

    function normalize_production(rows) {
        return (rows || []).map(d => ({
            ...d,
            brick_size:   String(d.brick_size || "").trim(),
            company:      String(d.company    || "").trim(),
            _brick_key:   normalize_brick(d.brick_size),
            _company_key: String(d.company    || "").trim().toLowerCase()
        }));
    }

    // =========================
    // DRILLDOWN MODAL
    // =========================
    function open_drilldown(title, columns, data) {

        if (!data || data.length === 0) {
            let modal = $(`
                <div class="drill-modal">
                    <div class="drill-box" style="max-width:400px;">
                        <div class="drill-header">
                            <span>${title}</span>
                            <button class="close-btn">&#10005;</button>
                        </div>
                        <div class="no-data">No records found for the current filters.</div>
                    </div>
                </div>
            `).appendTo("#dash-root");
            modal.find(".close-btn").on("click", () => modal.remove());
            modal.on("click", e => { if ($(e.target).is(".drill-modal")) modal.remove(); });
            return;
        }

        let rows = data.map((r, idx) => `
            <tr>
                <td>${idx + 1}</td>
                ${columns.map(c => `<td>${r[c] != null ? r[c] : ""}</td>`).join("")}
            </tr>
        `).join("");

        let modal = $(`
            <div class="drill-modal">
                <div class="drill-box">
                    <div class="drill-header">
                        <span>${title} <span style="font-weight:400;color:#999;">(${data.length} records)</span></span>
                        <button class="close-btn">&#10005;</button>
                    </div>
                    <div class="drill-body">
                        <table>
                            <thead>
                                <tr>
                                    <th>SI No</th>
                                    ${columns.map(c => `<th>${c.replace(/_/g, ' ')}</th>`).join("")}
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `).appendTo("#dash-root");

        modal.find(".close-btn").on("click", () => modal.remove());
        modal.on("click", e => { if ($(e.target).is(".drill-modal")) modal.remove(); });
    }

    // =========================
    // FILTER FUNCTIONS
    // =========================
    function filter_for_customer(data) {
        return data.filter(d => {
            let date = String(d.date || d.posting_date || "");
            if (filters.from_date  && date < filters.from_date)               return false;
            if (filters.to_date    && date > filters.to_date)                 return false;
            if (filters.customer   && d._customer_key !== filters.customer)   return false;
            if (filters.brick_size && d._brick_key    !== filters.brick_size) return false;
            if (filters.company    && d._company_key  !== filters.company)    return false;
            return true;
        });
    }

    function filter_for_brick_size(data) {
        return data.filter(d => {
            let date = String(d.date || d.posting_date || "");
            if (filters.from_date && date < filters.from_date)              return false;
            if (filters.to_date   && date > filters.to_date)                return false;
            if (filters.customer  && d._customer_key !== filters.customer)  return false;
            if (filters.company   && d._company_key  !== filters.company)   return false;
            return true;
        });
    }

    function filter_for_production(data) {
        return data.filter(d => {
            let date = String(d.date || "");
            if (filters.from_date && date < filters.from_date)             return false;
            if (filters.to_date   && date > filters.to_date)               return false;
            if (filters.company   && d._company_key !== filters.company)   return false;
            return true;
        });
    }

    function filter_for_material(data) {
        return data.filter(d => {
            let date = String(d.date || "");
            if (filters.from_date && date < filters.from_date)             return false;
            if (filters.to_date   && date > filters.to_date)               return false;
            if (filters.company   && d._company_key !== filters.company)   return false;
            return true;
        });
    }

    // =========================
    // SAFE CHART INIT
    // =========================
    function get_chart(key, dom_id) {
        if (charts[key]) { charts[key].dispose(); charts[key] = null; }
        charts[key] = echarts.init(document.getElementById(dom_id));
        return charts[key];
    }

    // =========================
    // LOAD DATA FROM SERVER
    // =========================
    function load_all() {

        frappe.call({
            method: "dashboard.dashboard.page.bricks2.bricks2.get_delivery_notes",
            callback: function(r) {
                delivery_data = normalize_delivery(r.message);
                populate_filters();
                render_customer();
                render_brick_size();
            }
        });

        frappe.call({
            method: "dashboard.dashboard.page.bricks2.bricks2.get_brick_production",
            callback: function(r) {
                production_data = normalize_production(r.message);
                render_production();
            }
        });

        frappe.call({
            method: "dashboard.dashboard.page.bricks2.bricks2.get_material_consumption",
            callback: function(r) {
                material_data = (r.message || []).map(d => ({
                    ...d,
                    company:      String(d.company || "").trim(),
                    _company_key: String(d.company || "").trim().toLowerCase()
                }));
                render_material();
            }
        });

        load_summary_data();
    }

    function load_summary_data() {
        frappe.call({
            method: "dashboard.dashboard.page.bricks2.bricks2.get_production_vs_sales",
            args: {
                from_date: filters.from_date,
                to_date:   filters.to_date,
                company:   filters.company
            },
            callback: function(r) {
                summary_data = r.message || [];
                render_summary_chart();
            }
        });
    }

    // =========================
    // POPULATE DROPDOWNS
    // =========================
    function populate_filters() {

        let customers = [...new Set(delivery_data.map(d => d.customer_name).filter(Boolean))].sort();
        let bricks    = [...new Set(delivery_data.map(d => d.brick_size).filter(Boolean))].sort();
        let companies = [...new Set(delivery_data.map(d => d.company).filter(Boolean))].sort();

        let $cust    = $("#customer_filter");
        let $brick   = $("#brick_filter");
        let $company = $("#company_filter");

        $cust.find("option:not(:first)").remove();
        $brick.find("option:not(:first)").remove();
        $company.find("option:not(:first)").remove();

        customers.forEach(c => $cust.append(`<option value="${c.toLowerCase()}">${c}</option>`));
        bricks.forEach(b    => $brick.append(`<option value="${normalize_brick(b)}">${b}</option>`));
        companies.forEach(c => $company.append(`<option value="${c.toLowerCase()}">${c}</option>`));

        $("#from_date").val(filters.from_date);
        $("#to_date").val(filters.to_date);

        $("#from_date, #to_date").off("change").on("change", function() {
            filters.from_date = $("#from_date").val() || null;
            filters.to_date   = $("#to_date").val()   || null;
            render_all();
        });

        $("#customer_filter").off("change").on("change", function() {
            filters.customer = $(this).val() || null;
            render_all();
        });

        $("#brick_filter").off("change").on("change", function() {
            filters.brick_size = $(this).val() || null;
            render_customer();
        });

        $("#company_filter").off("change").on("change", function() {
            filters.company = $(this).val() || null;
            render_all();
        });

        $("#clear_filters").off("click").on("click", function() {
            filters = { from_date: null, to_date: null, customer: null, brick_size: null, company: null };
            $("#from_date").val("");
            $("#to_date").val("");
            $("#customer_filter").val("");
            $("#brick_filter").val("");
            $("#company_filter").val("");
            render_all();
        });
    }

    // =========================
    // NUMBER FORMATTER
    // =========================
    function format_short_number(value) {
        value = Number(value || 0);
        if (value >= 10000000) return (value / 10000000).toFixed(2) + " Cr";
        if (value >= 100000)   return (value / 100000).toFixed(2)   + " L";
        if (value >= 1000)     return (value / 1000).toFixed(2)     + " K";
        return value.toFixed(2);
    }

    function render_all() {
        render_customer();
        render_brick_size();
        render_production();
        render_material();
        load_summary_data();
    }

    // =========================
    // CHART 1: CUSTOMER DELIVERY
    // =========================
    function render_customer() {
        let data = filter_for_customer(delivery_data);
        let map  = {};
        data.forEach(d => {
            let c = d.customer_name || "No Customer";
            if (!map[c]) map[c] = { qty: 0, amount: 0 };
            map[c].qty    += Number(d.quantity)     || 0;
            map[c].amount += Number(d.grand_amount) || 0;
        });

        let keys  = Object.keys(map);
        let chart = get_chart("customer", "customerChart");

        chart.setOption({
            tooltip: { trigger: "axis" },
            legend:  { data: ["Qty", "Grand Amount"] },
            grid:    { left: 60, right: 20, bottom: 60, top: 40, containLabel: true },
            xAxis: {
                type: "category",
                data: keys,
                axisLabel: { rotate: keys.length > 5 ? 30 : 0, fontSize: 11 }
            },
            yAxis: { type: "value" },
            series: [
                {
                    name: "Qty", type: "bar",
                    data: keys.map(k => Number(map[k].qty).toFixed(2)),
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), fontSize: 10, color: "#090909" }
                },
                {
                    name: "Grand Amount", type: "bar",
                    data: keys.map(k => Number(map[k].amount).toFixed(2)),
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), fontSize: 10, color: "#000000" }
                }
            ]
        });

        chart.off("click");
        chart.on("click", function(params) {
            let nameKey  = params.name.toLowerCase();
            let filtered = data.filter(d => d._customer_key === nameKey);
            open_drilldown(
                "Delivery Notes — " + params.name,
                ["id", "company", "date", "brick_size", "quantity", "rate", "grand_amount"],
                filtered
            );
        });
    }

    // =========================
    // CHART 2: BRICK SIZE DELIVERY
    // =========================
    function render_brick_size() {
        let data = filter_for_brick_size(delivery_data);
        let map  = {};
        data.forEach(d => {
            let s = d.brick_size || "Unknown";
            if (!map[s]) map[s] = { qty: 0, amount: 0 };
            map[s].qty    += Number(d.quantity)     || 0;
            map[s].amount += Number(d.grand_amount) || 0;
        });

        let keys  = Object.keys(map);
        let chart = get_chart("brickSize", "brickSizeChart");

        chart.setOption({
            tooltip: { trigger: "axis" },
            legend:  { data: ["Qty", "Grand Amount"] },
            grid:    { left: 60, right: 20, bottom: 60, top: 40, containLabel: true },
            xAxis: {
                type: "category",
                data: keys,
                axisLabel: { rotate: keys.length > 5 ? 30 : 0, fontSize: 11 }
            },
            yAxis: { type: "value" },
            series: [
                {
                    name: "Qty", type: "bar",
                    data: keys.map(k => Number(map[k].qty)),
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), fontSize: 10, color: "#090909" }
                },
                {
                    name: "Grand Amount", type: "bar",
                    data: keys.map(k => Number(map[k].amount)),
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), fontSize: 10, color: "#000000" }
                }
            ]
        });

        chart.off("click");
        chart.on("click", function(params) {
            let nameKey  = normalize_brick(params.name);
            let filtered = data.filter(d => d._brick_key === nameKey);
            open_drilldown(
                "Brick Size Details — " + params.name,
                ["customer_name", "company", "date", "brick_size", "quantity", "rate", "grand_amount"],
                filtered
            );
        });
    }

    // =========================
    // CHART 3: PRODUCTION
    // =========================
    function render_production() {
        let data = filter_for_production(production_data);
        let map  = {};
        data.forEach(d => {
            let key = d.brick_size || "Unknown";
            if (!map[key]) map[key] = { produced_bricks: 0, total_production_cost: 0 };
            map[key].produced_bricks       += Number(d.produced_bricks)       || 0;
            map[key].total_production_cost += Number(d.total_production_cost) || 0;
        });

        let keys  = Object.keys(map);
        let chart = get_chart("production", "productionChart");

        chart.setOption({
            tooltip: { trigger: "axis" },
            legend:  { data: ["Produced Bricks", "Total Cost"] },
            grid:    { left: 60, right: 20, bottom: 60, top: 40, containLabel: true },
            xAxis: {
                type: "category",
                data: keys,
                axisLabel: { rotate: keys.length > 5 ? 30 : 0, fontSize: 11 }
            },
            yAxis: { type: "value" },
            series: [
                {
                    name: "Produced Bricks", type: "bar",
                    data: keys.map(k => Number(map[k].produced_bricks)),
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), fontSize: 10, color: "#090909" }
                },
                {
                    name: "Total Cost", type: "bar",
                    data: keys.map(k => Number(map[k].total_production_cost)),
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), fontSize: 10, color: "#000000" }
                }
            ]
        });

        chart.off("click");
        chart.on("click", function(params) {
            let nameKey  = normalize_brick(params.name);
            let filtered = data.filter(d => d._brick_key === nameKey);
            open_drilldown(
                "Production Details — " + params.name,
                ["date", "company", "brick_size", "produced_bricks", "total_production_cost"],
                filtered
            );
        });
    }

    // =========================
    // CHART 4: RAW MATERIAL
    // =========================
    function render_material() {
        let data = filter_for_material(material_data);
        let map  = {};
        data.forEach(d => {
            let m  = d.raw_material || "Unknown";
            map[m] = (map[m] || 0) + (Number(d.quantity) || 0);
        });

        let keys  = Object.keys(map);
        let chart = get_chart("material", "materialChart");

        chart.setOption({
            tooltip: {
                trigger: "axis",
                formatter: p => `${p[0].name}<br/>Qty (MT): ${Number(p[0].value).toFixed(3)}`
            },
            grid:  { left: 60, right: 20, bottom: 60, top: 40, containLabel: true },
            xAxis: {
                type: "category",
                data: keys,
                axisLabel: { rotate: keys.length > 5 ? 30 : 0, fontSize: 11 }
            },
            yAxis: { type: "value", name: "MT" },
            series: [{
                name: "Qty", type: "bar",
                data: keys.map(k => Number(map[k])),
                label: { show: true, position: "inside", formatter: p => format_short_number(p.value), fontSize: 10, color: "#000000" }
            }]
        });

        chart.off("click");
        chart.on("click", function(params) {
            let filtered = data.filter(d => (d.raw_material || "Unknown") === params.name);
            open_drilldown(
                "Material Details — " + params.name,
                ["date", "company", "raw_material", "quantity"],
                filtered
            );
        });
    }

    // =========================
    // CHART 5: PRODUCTION vs SALES SUMMARY
    // =========================
    function render_summary_chart() {
        let data = summary_data || [];

        if (filters.company) {
            data = data.filter(d => String(d.company || "").toLowerCase() === filters.company);
        }

        let items           = data.map(d => d.item);
        let grand_amount    = data.map(d => Number(d.total_sales_amount    || 0));
        let production_cost = data.map(d => Number(d.total_production_cost || 0));
        let balance         = data.map(d => Number(d.balance               || 0));

        let chart = get_chart("summary", "summaryChart");

        chart.setOption({
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            legend:  { data: ["Grand Amount", "Production Cost", "Balance"] },
            grid:    { left: 60, right: 20, bottom: 80, top: 50, containLabel: true },
            xAxis: {
                type: "category",
                data: items,
                axisLabel: { rotate: items.length > 5 ? 30 : 0, fontSize: 11 }
            },
            yAxis: { type: "value" },
            series: [
                {
                    name: "Grand Amount", type: "bar",
                    data: grand_amount,
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), color: "#fff", fontSize: 10 }
                },
                {
                    name: "Production Cost", type: "bar",
                    data: production_cost,
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), color: "#fff", fontSize: 10 }
                },
                {
                    name: "Balance", type: "bar",
                    data: balance,
                    label: { show: true, position: "inside", formatter: p => format_short_number(p.value), color: "#fff", fontSize: 10 }
                }
            ]
        });

        chart.off("click");
        chart.on("click", function(params) {
            let row = data.filter(d => d.item === params.name);
            open_drilldown(
                "Production vs Sales — " + params.name,
                ["item", "produced_bricks", "total_production_cost", "total_sales_amount", "balance"],
                row
            );
        });
    }

    // =========================
    // RESIZE HANDLER
    // =========================
    window.addEventListener('resize', function() {
        Object.values(charts).forEach(function(c) { if (c) c.resize(); });
    });

    load_all();
};