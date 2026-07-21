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

    // filters now hold ARRAYS for multi-select fields
    let filters = {
        from_date:     "2025-12-09",
        to_date:       today,
        customers:     [],
        brick_sizes:   [],
        companies:     [],
        raw_materials: []
    };

    // Definition of every multi-select filter: key -> {label, elId}
    const MULTI_FILTERS = [
        { key: "customers",     label: "Customer",     placeholder: "All Customers" },
        { key: "brick_sizes",   label: "Brick Size",   placeholder: "All Brick Sizes" },
        { key: "companies",     label: "Company",      placeholder: "All Companies" },
        { key: "raw_materials", label: "Raw Material",  placeholder: "All Materials" }
    ];

    $(page.body).html(`
        <style>
            #dash-root { position: relative; min-height: 100vh; box-sizing: border-box; width: 100%; font-family: inherit; }
            .dash-grid { display: grid; grid-template-columns: 1fr; gap: 20px; padding: 15px; box-sizing: border-box; }
            @media(min-width:1200px) { .dash-grid { grid-template-columns: 1fr 1fr; } }
            .card-box { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); min-width: 0; }
            .title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #2c3e50; }

            /* ================= FILTER BAR ================= */
            .filter-bar {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                padding: 12px 16px;
                background: #f8f9fa;
                border-bottom: 1px solid #eee;
                align-items: flex-end;
                box-sizing: border-box;
                width: 100%;
                position: relative;
                z-index: 50;
            }
            .filter-group { display: flex; flex-direction: column; gap: 3px; }
            .filter-bar label { font-size: 10.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .3px; }
            .filter-bar input[type="date"] {
                padding: 6px 8px;
                font-size: 12px;
                border: 1px solid #dcdfe4;
                border-radius: 6px;
                min-width: 130px;
                box-sizing: border-box;
                background: #fff;
            }
            .filter-actions { display: flex; gap: 8px; margin-left: auto; align-items: flex-end; }
            .btn-clear, .btn-apply {
                padding: 7px 14px;
                font-size: 12px;
                font-weight: 600;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                white-space: nowrap;
            }
            .btn-clear { background: #fff; color: #e74c3c; border: 1px solid #f1b0a8; }
            .btn-clear:hover { background: #fdecea; }
            .btn-apply { background: #2c3e50; color: #fff; }
            .btn-apply:hover { background: #1f2c38; }

            /* Active filter chips */
            .active-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px 0 16px; }
            .chip {
                display: inline-flex; align-items: center; gap: 6px;
                background: #eaf1ff; color: #2c5aa0; border: 1px solid #cfe0fb;
                border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 500;
            }
            .chip .chip-x { cursor: pointer; font-weight: 700; color: #6d94c9; }
            .chip .chip-x:hover { color: #2c5aa0; }
            .active-chips:empty { display: none; }

            /* ================= MULTI-SELECT ================= */
            .ms-filter { position: relative; }
            .ms-control {
                display: flex; align-items: center; justify-content: space-between; gap: 8px;
                min-width: 150px; max-width: 190px;
                padding: 6px 8px;
                font-size: 12px;
                border: 1px solid #dcdfe4;
                border-radius: 6px;
                background: #fff;
                cursor: pointer;
                user-select: none;
            }
            .ms-control:hover { border-color: #b9c2cc; }
            .ms-control.active { border-color: #2c3e50; box-shadow: 0 0 0 2px rgba(44,62,80,0.08); }
            .ms-control .ms-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; }
            .ms-control .ms-count {
                background: #2c3e50; color: #fff; border-radius: 10px; font-size: 10px;
                padding: 1px 6px; flex-shrink: 0;
            }
            .ms-control .ms-caret { color: #999; font-size: 10px; flex-shrink: 0; }
            .ms-panel {
                display: none;
                position: absolute; top: calc(100% + 4px); left: 0;
                width: 230px; max-height: 280px;
                background: #fff; border: 1px solid #e2e5e9; border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                z-index: 999;
                flex-direction: column;
                overflow: hidden;
            }
            .ms-panel.open { display: flex; }
            .ms-search-wrap { padding: 8px; border-bottom: 1px solid #f0f1f3; }
            .ms-search {
                width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 12px;
                border: 1px solid #e2e5e9; border-radius: 5px;
            }
            .ms-actions-row {
                display: flex; justify-content: space-between; padding: 6px 10px;
                border-bottom: 1px solid #f0f1f3; font-size: 11px;
            }
            .ms-actions-row a { color: #2c5aa0; cursor: pointer; }
            .ms-actions-row a:hover { text-decoration: underline; }
            .ms-options { overflow-y: auto; padding: 4px 0; }
            .ms-option {
                display: flex; align-items: center; gap: 8px;
                padding: 6px 12px; font-size: 12.5px; cursor: pointer; color: #333;
            }
            .ms-option:hover { background: #f5f7fa; }
            .ms-option input { pointer-events: none; }
            .ms-empty { padding: 12px; text-align: center; color: #aaa; font-size: 12px; }

            /* Modal */
            .drill-modal {
                position: absolute;
                top: 0; left: 0;
                width: 100%;
                min-height: 100%;
                background: rgba(0,0,0,0.35);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
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
                <div class="filter-group">
                    <label>From</label>
                    <input type="date" id="from_date">
                </div>
                <div class="filter-group">
                    <label>To</label>
                    <input type="date" id="to_date">
                </div>

                ${MULTI_FILTERS.map(f => `
                    <div class="filter-group">
                        <label>${f.label}</label>
                        <div class="ms-filter" data-key="${f.key}">
                            <div class="ms-control" tabindex="0">
                                <span class="ms-text">${f.placeholder}</span>
                                <span class="ms-caret">&#9662;</span>
                            </div>
                            <div class="ms-panel">
                                <div class="ms-search-wrap">
                                    <input type="text" class="ms-search" placeholder="Search ${f.label.toLowerCase()}...">
                                </div>
                                <div class="ms-actions-row">
                                    <a class="ms-all">Select all</a>
                                    <a class="ms-clear">Clear</a>
                                </div>
                                <div class="ms-options"></div>
                            </div>
                        </div>
                    </div>
                `).join("")}

                <div class="filter-actions">
                    <button class="btn-clear" id="clear_filters">&#10005; Clear All</button>
                </div>
            </div>

            <div class="active-chips" id="active_chips"></div>

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

    function tooltipFormatter(params) {
        if (!Array.isArray(params)) {
            params = [params];
        }
        let html = params[0].axisValue + "<br/>";
        params.forEach(p => {
            html += `${p.marker} ${p.seriesName}: ${Number(p.value || 0).toFixed(2)}<br/>`;
        });
        return html;
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
    // MULTI-SELECT DROPDOWN ENGINE
    // =========================
    // Holds the raw (label, value) option list for each filter key
    let ms_options_cache = {};

    function build_multiselect(key, options) {
        // options: [{label, value}]
        ms_options_cache[key] = options;

        let $filter  = $(`.ms-filter[data-key="${key}"]`);
        let $panel   = $filter.find(".ms-panel");
        let $optWrap = $filter.find(".ms-options");
        let $search  = $filter.find(".ms-search");

        function render_options(filterText) {
            let text = (filterText || "").toLowerCase();
            let visible = options.filter(o => o.label.toLowerCase().includes(text));

            if (visible.length === 0) {
                $optWrap.html(`<div class="ms-empty">No matches</div>`);
                return;
            }

            $optWrap.html(visible.map(o => {
                let checked = filters[key].includes(o.value) ? "checked" : "";
                return `
                    <label class="ms-option">
                        <input type="checkbox" value="${o.value}" ${checked}>
                        <span>${o.label}</span>
                    </label>
                `;
            }).join(""));
        }

        render_options("");
        update_control_label(key);

        $search.off("input").on("input", function() {
            render_options($(this).val());
        });

        $optWrap.off("click", ".ms-option").on("click", ".ms-option", function(e) {
            e.preventDefault();
            let $cb = $(this).find("input");
            let val = $cb.val();
            let checked = !$cb.prop("checked");
            $cb.prop("checked", checked);

            let idx = filters[key].indexOf(val);
            if (checked && idx === -1) filters[key].push(val);
            if (!checked && idx !== -1) filters[key].splice(idx, 1);

            update_control_label(key);
            render_chips();
            on_filters_changed(key);
        });

        $filter.find(".ms-all").off("click").on("click", function(e) {
            e.preventDefault();
            filters[key] = options.map(o => o.value);
            render_options($search.val());
            update_control_label(key);
            render_chips();
            on_filters_changed(key);
        });

        $filter.find(".ms-clear").off("click").on("click", function(e) {
            e.preventDefault();
            filters[key] = [];
            render_options($search.val());
            update_control_label(key);
            render_chips();
            on_filters_changed(key);
        });

        $filter.find(".ms-control").off("click").on("click", function(e) {
            e.stopPropagation();
            let is_open = $panel.hasClass("open");
            $(".ms-panel").removeClass("open");
            $(".ms-control").removeClass("active");
            if (!is_open) {
                $panel.addClass("open");
                $(this).addClass("active");
                $search.val("").trigger("focus");
                render_options("");
            }
        });
    }

    function update_control_label(key) {
        let def = MULTI_FILTERS.find(f => f.key === key);
        let $control = $(`.ms-filter[data-key="${key}"] .ms-control`);
        let count = filters[key].length;

        $control.find(".ms-count").remove();

        if (count === 0) {
            $control.find(".ms-text").text(def.placeholder);
        } else {
            let opts = ms_options_cache[key] || [];
            let firstLabel = (opts.find(o => o.value === filters[key][0]) || {}).label || filters[key][0];
            $control.find(".ms-text").text(firstLabel);
            if (count > 0) {
                $control.find(".ms-caret").before(`<span class="ms-count">${count}</span>`);
            }
        }
    }

    // Close any open dropdown when clicking outside
    $(document).off("click.msdropdown").on("click.msdropdown", function() {
        $(".ms-panel").removeClass("open");
        $(".ms-control").removeClass("active");
    });

    // =========================
    // ACTIVE FILTER CHIPS
    // =========================
    function render_chips() {
        let $chips = $("#active_chips");
        let html = "";

        MULTI_FILTERS.forEach(f => {
            let opts = ms_options_cache[f.key] || [];
            filters[f.key].forEach(val => {
                let label = (opts.find(o => o.value === val) || {}).label || val;
                html += `<span class="chip" data-key="${f.key}" data-val="${val}">${f.label}: ${label} <span class="chip-x">&#10005;</span></span>`;
            });
        });

        $chips.html(html);

        $chips.off("click", ".chip-x").on("click", ".chip-x", function() {
            let $chip = $(this).closest(".chip");
            let key = $chip.data("key");
            let val = String($chip.data("val"));
            let idx = filters[key].indexOf(val);
            if (idx !== -1) filters[key].splice(idx, 1);

            // sync checkbox state in the dropdown if currently rendered
            $(`.ms-filter[data-key="${key}"] .ms-option input[value="${val}"]`).prop("checked", false);
            update_control_label(key);
            render_chips();
            on_filters_changed(key);
        });
    }

    // Called whenever any multi-select filter changes; routes to the right re-render
    function on_filters_changed(changed_key) {
        if (changed_key === "companies") {
            render_all();
        } else if (changed_key === "customers") {
            render_customer();
            render_brick_size();
        } else if (changed_key === "brick_sizes") {
            render_customer();
            render_production();
        } else if (changed_key === "raw_materials") {
            render_material();
        } else {
            render_all();
        }
    }

    // =========================
    // FILTER FUNCTIONS
    // =========================
    function filter_for_customer(data) {
        return data.filter(d => {
            let date = String(d.date || d.posting_date || "");
            if (filters.from_date && date < filters.from_date) return false;
            if (filters.to_date   && date > filters.to_date)   return false;
            if (filters.customers.length     && !filters.customers.includes(d._customer_key)) return false;
            if (filters.brick_sizes.length   && !filters.brick_sizes.includes(d._brick_key))   return false;
            if (filters.companies.length     && !filters.companies.includes(d._company_key))   return false;
            return true;
        });
    }

    function filter_for_brick_size(data) {
        return data.filter(d => {
            let date = String(d.date || d.posting_date || "");
            if (filters.from_date && date < filters.from_date) return false;
            if (filters.to_date   && date > filters.to_date)   return false;
            if (filters.customers.length && !filters.customers.includes(d._customer_key)) return false;
            if (filters.companies.length && !filters.companies.includes(d._company_key))  return false;
            return true;
        });
    }

    function filter_for_production(data) {
        return data.filter(d => {
            let date = String(d.date || "");
            if (filters.from_date && date < filters.from_date) return false;
            if (filters.to_date   && date > filters.to_date)   return false;
            if (filters.companies.length   && !filters.companies.includes(d._company_key)) return false;
            if (filters.brick_sizes.length && !filters.brick_sizes.includes(d._brick_key)) return false;
            return true;
        });
    }

    function filter_for_material(data) {
        return data.filter(d => {
            let date = String(d.date || "");
            if (filters.from_date && date < filters.from_date) return false;
            if (filters.to_date   && date > filters.to_date)   return false;
            if (filters.companies.length && !filters.companies.includes(d._company_key)) return false;
            if (filters.raw_materials.length &&
                !filters.raw_materials.includes(String(d.raw_material || "").toLowerCase())) return false;
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
                populate_material_filter();
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
                company:   filters.companies.join(",")
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

        build_multiselect("customers", customers.map(c => ({ label: c, value: c.toLowerCase() })));
        build_multiselect("brick_sizes", bricks.map(b => ({ label: b, value: normalize_brick(b) })));
        build_multiselect("companies", companies.map(c => ({ label: c, value: c.toLowerCase() })));

        $("#from_date").val(filters.from_date);
        $("#to_date").val(filters.to_date);

        $("#from_date, #to_date").off("change").on("change", function() {
            filters.from_date = $("#from_date").val() || null;
            filters.to_date   = $("#to_date").val()   || null;
            render_all();
        });

        $("#clear_filters").off("click").on("click", function() {
            filters = { from_date: null, to_date: null, customers: [], brick_sizes: [], companies: [], raw_materials: [] };
            $("#from_date").val("");
            $("#to_date").val("");
            MULTI_FILTERS.forEach(f => update_control_label(f.key));
            $(".ms-option input").prop("checked", false);
            render_chips();
            render_all();
        });
    }

    function populate_material_filter() {
        let materials = [...new Set(material_data.map(d => d.raw_material).filter(Boolean))].sort();
        build_multiselect("raw_materials", materials.map(m => ({ label: m, value: String(m).toLowerCase() })));
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
            tooltip: { trigger: "axis", formatter: tooltipFormatter },
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
            tooltip: { trigger: "axis", formatter: tooltipFormatter },
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
            tooltip: { trigger: "axis", formatter: tooltipFormatter },
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

        let items = data.map(d => d.item);
        let produced_qty = data.map(d => Number(d.produced_qty || 0));
        let sold_qty = data.map(d => Number(d.sold_qty || 0));
        let balance_qty = data.map(d => Number(d.balance_qty || 0));

        let chart = get_chart("summary", "summaryChart");

        chart.setOption({
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: tooltipFormatter
            },

            legend: {
                data: ["Produced Qty", "Sold Qty", "Balance Qty"]
            },

            grid: {
                left: 60,
                right: 20,
                bottom: 80,
                top: 50,
                containLabel: true
            },

            xAxis: {
                type: "category",
                data: items,
                axisLabel: {
                    rotate: items.length > 5 ? 30 : 0,
                    fontSize: 11
                }
            },

            yAxis: {
                type: "value"
            },

            series: [
                {
                    name: "Produced Qty",
                    type: "bar",
                    data: produced_qty,
                    label: {
                        show: true,
                        position: "inside",
                        formatter: p => format_short_number(p.value),
                        color: "#fff",
                        fontSize: 10
                    }
                },
                {
                    name: "Sold Qty",
                    type: "bar",
                    data: sold_qty,
                    label: {
                        show: true,
                        position: "inside",
                        formatter: p => format_short_number(p.value),
                        color: "#fff",
                        fontSize: 10
                    }
                },
                {
                    name: "Balance Qty",
                    type: "bar",
                    data: balance_qty,
                    label: {
                        show: true,
                        position: "inside",
                        formatter: p => format_short_number(p.value),
                        color: "#fff",
                        fontSize: 10
                    }
                }
            ]
        });

        chart.off("click");

        chart.on("click", function(params) {
            let row = data.filter(d => d.item === params.name);
            open_drilldown(
                "Production vs Sales — " + params.name,
                ["item", "company", "produced_qty", "sold_qty", "balance_qty"],
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