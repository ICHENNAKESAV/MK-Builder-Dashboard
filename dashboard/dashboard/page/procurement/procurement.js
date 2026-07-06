frappe.pages['procurement'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Interactive Procurement Dashboard',
        single_column: true
    });

    $(wrapper).css('padding', '0px');
    $(wrapper).find('.page-head').hide();
    $(page.body).parent().css('padding', '0px');

    $(page.body).html(`
        <div><h2>Procurement Dashboard</h2></div>
        <div style="padding: 25px; background-color: #f8f9fa; min-height: 100vh; font-family: sans-serif;">

            <div id="dashboard-filter-bar" style="background: #fff; padding: 18px 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 25px;"></div>

            <div class="row" id="kpi-container" style="display: flex; gap: 12px; margin-bottom: 25px; flex-wrap: wrap;"></div>

            <div style="display: flex; gap: 20px; margin-bottom: 25px; flex-wrap: wrap;">
                <div id="item-balance-bar" style="flex: 1; min-width: 450px; height: 450px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);"></div>
                <div id="item-pending-bar" style="flex: 1; min-width: 450px; height: 450px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);"></div>
            </div>

            <div style="display: flex; gap: 20px; margin-bottom: 25px; flex-wrap: wrap;">
                <div id="receipt-status-donut" style="flex: 1; min-width: 450px; height: 380px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);"></div>
                <div id="invoice-status-donut" style="flex: 1; min-width: 450px; height: 380px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);"></div>
            </div>

            <div id="procurement-funnel" style="width: 100%; height: 450px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);"></div>
        </div>
    `);

    if (!$('#procurement-filter-style').length) {
        $('<style id="procurement-filter-style">')
            .text(`
                .pd-filter-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
                .pd-filter-field { flex: 1; min-width: 170px; position: relative; }
                .pd-filter-field label { font-size: 11px; color: #7f8c8d; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 6px; display: block; }
                .pd-filter-field input[type=date] {
                    width: 100%; box-sizing: border-box; padding: 8px 30px 8px 10px; font-size: 13px;
                    border: 1px solid #dde1e6; border-radius: 6px; background: #fbfbfc; color: #2c3e50;
                    outline: none; transition: border-color .15s, box-shadow .15s;
                }
                .pd-filter-field input[type=date]:focus {
                    border-color: #1abc9c; box-shadow: 0 0 0 3px rgba(26,188,156,0.15); background: #fff;
                }
                .pd-filter-clear {
                    position: absolute; right: 8px; top: 30px; cursor: pointer; color: #b0b7bd;
                    font-size: 13px; display: none; user-select: none; z-index: 2;
                }
                .pd-filter-field.has-value .pd-filter-clear { display: block; }
                .pd-filter-field.has-value input[type=date] { border-color: #1abc9c; }
                .pd-filter-actions { display: flex; gap: 8px; }
                .pd-btn {
                    padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer;
                    border: 1px solid transparent; transition: opacity .15s;
                }
                .pd-btn:hover { opacity: 0.85; }
                .pd-btn-clear { background: #fff; border-color: #dde1e6; color: #7f8c8d; }
                .pd-btn-apply { background: #1abc9c; color: #fff; }
                .kpi-card { flex: 1; min-width: 190px; background: #fff; padding: 15px; border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s; }
                .kpi-card .kpi-label { font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; }
                .kpi-card .kpi-value { font-size: 18px; font-weight: bold; color: #2c3e50; }

                .pd-ms-control {
                    width: 100%; box-sizing: border-box; padding: 8px 30px 8px 10px; font-size: 13px;
                    border: 1px solid #dde1e6; border-radius: 6px; background: #fbfbfc; color: #2c3e50;
                    cursor: pointer; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .pd-ms-control:after { content: '\\25BE'; float: right; color: #9aa1a6; }
                .pd-filter-field.has-value .pd-ms-control { border-color: #1abc9c; }
                .pd-ms-panel {
                    display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; width: 260px; max-width: 90vw;
                    background: #fff; border: 1px solid #dde1e6; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.12);
                    z-index: 50; padding: 8px;
                }
                .pd-ms-search {
                    width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; margin-bottom: 6px;
                    border: 1px solid #dde1e6; border-radius: 6px; outline: none;
                }
                .pd-ms-search:focus { border-color: #1abc9c; }
                .pd-ms-options { max-height: 240px; overflow-y: auto; }
                .pd-ms-option {
                    display: flex; align-items: center; gap: 8px; padding: 6px 6px; font-size: 12.5px;
                    color: #2c3e50; border-radius: 4px; cursor: pointer;
                }
                .pd-ms-option:hover { background: #f3f4f6; }
                .pd-ms-option input { margin: 0; }
                .pd-ms-empty { padding: 10px 6px; font-size: 12px; color: #9aa1a6; text-align: center; }
                .pd-ms-hint { padding: 6px 6px 0; font-size: 11px; color: #9aa1a6; border-top: 1px solid #f0f1f2; margin-top: 4px; }
            `)
            .appendTo('head');
    }

    // ★ CHANGE: item_code filter replaced with item_group filter throughout.
    const MULTISELECT_FIELDS = [
        { fieldname: 'company', label: 'Company', plural: 'Companies' },
        { fieldname: 'supplier', label: 'Supplier', plural: 'Suppliers' },
        { fieldname: 'item_group', label: 'Item Group', plural: 'Item Groups' },
        { fieldname: 'project', label: 'Project', plural: 'Projects' }
    ];
    const MAX_VISIBLE_OPTIONS = 20;

    let current_filters = {
        supplier: [], from_date: "", to_date: "", project: [], company: [], item_group: []
    };
    let filter_options = { companies: [], suppliers: [], projects: [], item_groups: [] };
    let debounce_handle = null;

    // ★ BUG FIX: previously every render_vertical_bar / render_donut_chart /
    // render_echart call added a brand-new `window.addEventListener('resize', ...)`
    // without ever removing the old one. After a handful of filter refreshes
    // there were several stale resize listeners stacked up, some pointing at
    // already-replaced chart instances. Charts are now tracked in a registry
    // and resized via a single, permanently-bound resize handler.
    let chart_instances = {};
    // ★ FIX: In ECharts v5, echarts.init() on a DOM node that already has an
    // instance returns the SAME existing instance, not a new one. The old
    // register_chart pattern was:
    //   1. echarts.init(dom)       → returns existing chart_A
    //   2. register_chart(id, ...) → disposes chart_A  (kills the chart we just got!)
    //   3. myChart.setOption(...)  → runs on a disposed instance → blank chart
    //
    // init_chart corrects the order: dispose first, then init, guaranteeing
    // setOption always runs on a live, freshly-initialised instance.
    function init_chart(elementId) {
        let chartDom = document.getElementById(elementId);
        if (!chartDom) return null;
        let existing = echarts.getInstanceByDom(chartDom);
        if (existing && !existing.isDisposed()) existing.dispose();
        delete chart_instances[elementId];
        let instance = echarts.init(chartDom);
        chart_instances[elementId] = instance;
        return instance;
    }
    $(window).off('resize.pd-charts').on('resize.pd-charts', function () {
        Object.values(chart_instances).forEach(function (c) {
            if (c && !c.isDisposed()) c.resize();
        });
    });

    // ★ FIX JS-1: Safe wrappers for format_currency / format_number.
    // Bare globals are not reliably present across all Frappe versions;
    // frappe.utils.fmt_money and frappe.utils.formatNumber are the stable API.
    function fmt_currency(value, currency) {
        try {
            return frappe.utils.fmt_money(value, {
                currency: currency || (frappe.boot.sysdefaults && frappe.boot.sysdefaults.currency)
            });
        } catch (e) {
            return parseFloat(value || 0).toFixed(2);
        }
    }
    function fmt_number(value, decimals) {
        try {
            return frappe.utils.formatNumber(value, null, decimals != null ? decimals : 2);
        } catch (e) {
            return parseFloat(value || 0).toFixed(decimals != null ? decimals : 2);
        }
    }

    function debounced_refresh() {
        clearTimeout(debounce_handle);
        debounce_handle = setTimeout(trigger_dashboard_refresh, 350);
    }

    function options_for(fieldname) {
        let map = { company: filter_options.companies, supplier: filter_options.suppliers,
                    item_group: filter_options.item_groups, project: filter_options.projects };
        return map[fieldname] || [];
    }

    function render_ms_options($field, fieldname, term) {
        let all = options_for(fieldname);
        let needle = (term || '').toLowerCase();
        let filtered = needle ? all.filter(v => v.toLowerCase().includes(needle)) : all;
        let shown = filtered.slice(0, MAX_VISIBLE_OPTIONS);
        let selected = current_filters[fieldname] || [];

        let $opts = $field.find('.pd-ms-options');
        if (!shown.length) {
            $opts.html(`<div class="pd-ms-empty">No matches</div>`);
        } else {
            $opts.html(shown.map(v => `
                <label class="pd-ms-option">
                    <input type="checkbox" value="${frappe.utils.escape_html(v)}" ${selected.includes(v) ? 'checked' : ''}>
                    <span>${frappe.utils.escape_html(v)}</span>
                </label>
            `).join(''));
        }

        $field.find('.pd-ms-hint').text(
            filtered.length > MAX_VISIBLE_OPTIONS
                ? `Showing ${MAX_VISIBLE_OPTIONS} of ${filtered.length} — refine search to see more`
                : ''
        );
    }

    function update_ms_summary($field, fieldname, plural) {
        let selected = current_filters[fieldname] || [];
        let $summary = $field.find('.pd-ms-summary');
        if (!selected.length) {
            $summary.text(`All ${plural}`);
        } else if (selected.length <= 2) {
            $summary.text(selected.join(', '));
        } else {
            $summary.text(`${selected.length} ${plural} selected`);
        }
    }

    function build_filter_bar() {
        let ms_fields_html = MULTISELECT_FIELDS.map(f => `
            <div class="pd-filter-field pd-multiselect" data-field="${f.fieldname}">
                <label>${f.label}</label>
                <div class="pd-ms-control">
                    <span class="pd-ms-summary">All ${f.plural}</span>
                </div>
                <span class="pd-filter-clear">&times;</span>
                <div class="pd-ms-panel">
                    <input type="text" class="pd-ms-search" placeholder="Search ${f.label.toLowerCase()}...">
                    <div class="pd-ms-options"></div>
                    <div class="pd-ms-hint"></div>
                </div>
            </div>
        `).join('');

        $('#dashboard-filter-bar').html(`
            <div class="pd-filter-row">
                ${ms_fields_html}
                <div class="pd-filter-field" data-field="from_date">
                    <label>From Date</label>
                    <input type="date">
                    <span class="pd-filter-clear">&times;</span>
                </div>
                <div class="pd-filter-field" data-field="to_date">
                    <label>To Date</label>
                    <input type="date">
                    <span class="pd-filter-clear">&times;</span>
                </div>
                <div class="pd-filter-actions">
                    <button type="button" class="pd-btn pd-btn-clear" id="pd-clear-all">Clear All</button>
                    <button type="button" class="pd-btn pd-btn-apply" id="pd-apply">Apply</button>
                </div>
            </div>
        `);

        $('#dashboard-filter-bar .pd-filter-field:not(.pd-multiselect)').each(function () {
            let $field = $(this);
            let fieldname = $field.data('field');
            let $input = $field.find('input');

            $input.on('change', function () {
                current_filters[fieldname] = $(this).val() || "";
                $field.toggleClass('has-value', !!current_filters[fieldname]);
                trigger_dashboard_refresh();
            });

            $field.find('.pd-filter-clear').on('click', function () {
                current_filters[fieldname] = "";
                $input.val("");
                $field.removeClass('has-value');
                trigger_dashboard_refresh();
            });
        });

        MULTISELECT_FIELDS.forEach(f => {
            let $field = $(`#dashboard-filter-bar .pd-multiselect[data-field="${f.fieldname}"]`);
            render_ms_options($field, f.fieldname, '');
            update_ms_summary($field, f.fieldname, f.plural);
            $field.toggleClass('has-value', (current_filters[f.fieldname] || []).length > 0);

            $field.find('.pd-ms-control').on('click', function (e) {
                e.stopPropagation();
                let $panel = $field.find('.pd-ms-panel');
                let isOpen = $panel.is(':visible');
                $('.pd-ms-panel').hide();
                if (!isOpen) {
                    $panel.show();
                    $field.find('.pd-ms-search').val('').focus();
                    render_ms_options($field, f.fieldname, '');
                }
            });

            $field.find('.pd-ms-search').on('click', function (e) { e.stopPropagation(); });
            $field.find('.pd-ms-search').on('input', function () {
                render_ms_options($field, f.fieldname, $(this).val());
            });

            $field.find('.pd-ms-panel').on('click', function (e) { e.stopPropagation(); });

            $field.find('.pd-ms-options').on('change', 'input[type=checkbox]', function () {
                let val = $(this).val();
                let selected = (current_filters[f.fieldname] || []).slice();
                if ($(this).is(':checked')) {
                    if (!selected.includes(val)) selected.push(val);
                } else {
                    selected = selected.filter(v => v !== val);
                }
                current_filters[f.fieldname] = selected;
                update_ms_summary($field, f.fieldname, f.plural);
                $field.toggleClass('has-value', selected.length > 0);
                debounced_refresh();
            });

            $field.find('.pd-filter-clear').on('click', function (e) {
                e.stopPropagation();
                current_filters[f.fieldname] = [];
                $field.removeClass('has-value');
                update_ms_summary($field, f.fieldname, f.plural);
                render_ms_options($field, f.fieldname, '');
                trigger_dashboard_refresh();
            });
        });

        $(document).off('click.pd-ms-close').on('click.pd-ms-close', function () {
            $('.pd-ms-panel').hide();
        });

        $('#pd-apply').on('click', trigger_dashboard_refresh);
        $('#pd-clear-all').on('click', function () {
            current_filters = { supplier: [], from_date: "", to_date: "", project: [], company: [], item_group: [] };
            build_filter_bar();
            trigger_dashboard_refresh();
        });
    }

    function trigger_dashboard_refresh() {
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_dashboard_kpis",
            args: { filters: current_filters },
            callback: function (r) {
                render_all_kpi_cards(r.message || {});
            }
        });

        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_pending_items_grouped",
            args: { filters: current_filters },
            callback: function (r) {
                let rows = r.message || [];
                render_vertical_bar('item-pending-bar', 'Pending Qty by Item Group',
                    rows.map(x => x.item_group), rows.map(x => flt(x.pending_qty)),
                    '#e74c3c', 'Qty', 'get_pending_items_sql');
            }
        });

        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_balance_to_pay_grouped",
            args: { filters: current_filters },
            callback: function (r) {
                let rows = r.message || [];
                render_vertical_bar('item-balance-bar', 'Financial Balance to Pay by Item Group',
                    rows.map(x => x.item_group), rows.map(x => flt(x.balance_to_pay)),
                    '#d35400', 'Val', 'get_balance_to_pay_sql');
            }
        });

        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_receipt_status_grouped",
            args: { filters: current_filters },
            callback: function (r) {
                let rows = r.message || [];
                let order = ['Not Received', 'Partially Received', 'Fully Received'];
                let data = order.map(name => ({
                    name, value: flt((rows.find(x => x.status === name) || {}).count || 0)
                }));
                render_donut_chart('receipt-status-donut', 'Items Receipt Status Breakdown', data,
                    ['#95a5a6', '#f1c40f', '#2ecc71'], 'get_po_receipt_status_sql');
            }
        });

        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_invoice_status_grouped",
            args: { filters: current_filters },
            callback: function (r) {
                let rows = r.message || [];
                let order = ['Not Billed', 'Partially Billed', 'Fully Billed'];
                let data = order.map(name => ({
                    name, value: flt((rows.find(x => x.status === name) || {}).count || 0)
                }));
                render_donut_chart('invoice-status-donut', 'Items Billing Status Breakdown', data,
                    ['#7f8c8d', '#e67e22', '#3498db'], 'get_po_invoice_status_sql');
            }
        });
    }

    frappe.call({
        method: "dashboard.dashboard.page.procurement.procurement.get_sum",
        callback: function (r) {
            if (!r.message) return;
            render_echart([
                { name: "Purchase Order", value: r.message.purchase_order || 0 },
                { name: "Purchase Receipt", value: r.message.purchase_receipt || 0 },
                { name: "Purchase Invoice", value: r.message.purchase_invoice || 0 },
                { name: "Payment Entry", value: r.message.payment_entry || 0 }
            ]);
        }
    });

    frappe.call({
        method: "dashboard.dashboard.page.procurement.procurement.get_filter_options",
        callback: function (r) {
            filter_options = r.message || filter_options;
            build_filter_bar();
            trigger_dashboard_refresh();
        }
    });

    // =====================================================================
    // FIX 1:  open_drilldown_dialog now accepts metric_type ('qty'|'amount')
    //         Column header is set dynamically — "Qty" or "Amount"
    // FIX 2:  Doctype route determined by method_name only, never by
    //         context_meta — prevents broken links when donut slices
    //         (which return PO rows) incorrectly routed to PR/PI
    // FIX 3:  Bar-chart drilldowns now key off item_group, not item_code
    // =====================================================================
    function open_drilldown_dialog(title, method_name, clicked_key, context_meta, metric_type) {

        let temp_filters = JSON.parse(JSON.stringify(current_filters));
        let display_title = "";

        // --- Dynamic Title Construction ---
        if (clicked_key === "All") {
            display_title = `${title} Overview`;
        } else if (context_meta === "Item Group") {
            display_title = `${title} Breakdown: Item Group [ ${clicked_key} ]`;
            temp_filters['item_group'] = [clicked_key];
        } else {
            display_title = `${title} Breakdown: Status [ ${clicked_key} ]`;
        }

        // ★ FIX 1: Dynamic column header based on metric type
        // ★ FIX JS-2: 'count' metric type → header shows ordered qty
        let metric_header = metric_type === 'qty' ? 'Qty' : metric_type === 'count' ? 'Ordered Qty' : 'Amount';

        let d = new frappe.ui.Dialog({
            title: display_title,
            size: 'large',
            no_focus: true
        });

        d.$body.html(`
            <div class="drilldown-loading" style="text-align:center; padding: 40px; color:#7f8c8d;">
                <i class="fa fa-spinner fa-spin fa-2x" style="margin-bottom: 10px; display: block; color: #1abc9c;"></i>
                Fetching detailed matrix tracking...
            </div>
            <div class="drilldown-table-wrapper" style="padding: 10px; max-height: 450px; overflow-y: auto;"></div>
        `);
        d.show();

        // ★ FIX: status is now passed as a real SQL filter argument instead of
        // being matched client-side against an unfiltered row set after the
        // fact. That client-side match was a second, independent computation
        // that could drift from the pie slice's own SQL-computed count
        // (e.g. if filters changed between the donut render and the click).
        // Filtering in the same query that computes the status guarantees
        // the drilldown row count always equals the slice's count.
        let call_args = { filters: temp_filters };
        if (clicked_key !== "All" && context_meta === "Status") {
            call_args.status = clicked_key;
        }

        frappe.call({
            method: `dashboard.dashboard.page.procurement.procurement.${method_name}`,
            args: call_args,
            callback: function (res) {
                d.$body.find('.drilldown-loading').remove();
                let records = res.message || [];

                if (!records.length) {
                    d.$body.find('.drilldown-table-wrapper').html(
                        `<div style="text-align:center; padding: 30px; color: #7f8c8d;">No matching active document tracks found.</div>`
                    );
                    return;
                }

                // ★ FIX 2: Doctype route driven ONLY by method_name
                //   get_po_receipt_status_sql / get_po_invoice_status_sql
                //   return Purchase Order rows, so they must route to purchase-order
                let doctype_route = 'purchase-order';
                if (method_name === 'get_purchase_receipts_sql') doctype_route = 'purchase-receipt';
                if (method_name === 'get_purchase_invoices_sql') doctype_route = 'purchase-invoice';

                let sysCurrency = frappe.boot.sysdefaults.currency;

                let is_po_doc = (method_name === 'get_purchase_orders_sql');
                let table_html = "";
                if (is_po_doc) {
                    table_html = `
                        <table class="table table-bordered table-condensed table-hover"
                               style="font-size: 13px; background:#fff; margin-bottom: 0px;">
                            <thead>
                                <tr style="background-color: #f3f4f6; color: #34495e; font-weight: bold;">
                                    <th style="width: 65px; text-align: center;">${__('S.No.')}</th>
                                    <th>${__('Document (Link)')}</th>
                                    <th>${__('Item')}</th>
                                    <th style="text-align: right;">${__('Qty')}</th>
                                    <th style="text-align: right;">${__('Amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                } else {
                    table_html = `
                        <table class="table table-bordered table-condensed table-hover"
                               style="font-size: 13px; background:#fff; margin-bottom: 0px;">
                            <thead>
                                <tr style="background-color: #f3f4f6; color: #34495e; font-weight: bold;">
                                    <th style="width: 65px; text-align: center;">${__('S.No.')}</th>
                                    <th>${__('Document (Link)')}</th>
                                    <th>${__('Date')}</th>
                                    <th>${__('Items / Description')}</th>
                                    <th style="text-align: right;">${__(metric_header)}</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                }

                records.forEach((row, idx) => {
                    let doc_name = row.purchase_order || row.po_number || row.name;
                    let doc_date = row.transaction_date ? frappe.datetime.str_to_user(row.transaction_date) : '-';

                    if (is_po_doc) {
                        let item_desc = row.items || '-';
                        let qty_disp = fmt_number(row.ordered_qty || 0, 2);
                        let amount_disp = fmt_currency(row.ordered_amount || 0, sysCurrency);

                        table_html += `
                            <tr>
                                <td style="text-align: center; font-weight: 600; color: #7f8c8d;">${idx + 1}</td>
                                <td>
                                    <a href="/app/${doctype_route}/${doc_name}" target="_blank"
                                       style="font-weight:bold; color:#1abc9c; text-decoration: underline; display: inline-block;">
                                        <i class="fa fa-external-link" style="font-size: 11px; margin-right: 4px;"></i>${doc_name}
                                    </a>
                                </td>
                                <td><span class="text-muted">${item_desc}</span></td>
                                <td style="text-align: right; font-weight:600; color:#2c3e50;">${qty_disp}</td>
                                <td style="text-align: right; font-weight:600; color:#2c3e50;">${amount_disp}</td>
                            </tr>
                        `;
                    } else {
                        let item_desc = row.item_code || row.items || '-';
                        let metric_disp = "";

                        // ★ FIX JS-1: format_currency/format_number replaced with safe wrappers
                        // ★ FIX JS-2: get_purchase_orders_sql handles 'count' metric_type
                        // ★ FIX JS-3: get_balance_to_pay_sql reads row.items explicitly
                        if (method_name === 'get_pending_items_sql') {
                            // Bar chart → Qty only
                            metric_disp = fmt_number(row.pending_qty, 2);

                        } else if (method_name === 'get_balance_to_pay_sql') {
                            // Bar chart → Amount only
                            // row.items is GROUP_CONCAT from SQL — must be read explicitly
                            metric_disp = fmt_currency(row.balance_to_pay, sysCurrency);
                            item_desc = row.items || '-';

                        } else if (method_name === 'get_po_receipt_status_sql') {
                            // Donut → Qty only
                            metric_disp = fmt_number(row.qty || 0, 2);

                        } else if (method_name === 'get_po_invoice_status_sql') {
                            // Donut → Qty only
                            metric_disp = fmt_number(row.qty || 0, 2);

                        } else if (method_name === 'get_purchase_receipts_sql' || method_name === 'get_purchase_invoices_sql') {
                            // KPI → Amount only
                            metric_disp = fmt_currency(row.ordered_amount || 0, sysCurrency);
                            item_desc = row.items || 'No items listed';
                        }

                        table_html += `
                            <tr>
                                <td style="text-align: center; font-weight: 600; color: #7f8c8d;">${idx + 1}</td>
                                <td>
                                    <a href="/app/${doctype_route}/${doc_name}" target="_blank"
                                       style="font-weight:bold; color:#1abc9c; text-decoration: underline; display: inline-block;">
                                        <i class="fa fa-external-link" style="font-size: 11px; margin-right: 4px;"></i>${doc_name}
                                    </a>
                                </td>
                                <td>${doc_date}</td>
                                <td><span class="text-muted">${item_desc}</span></td>
                                <td style="text-align: right; font-weight:600; color:#2c3e50;">${metric_disp}</td>
                            </tr>
                        `;
                    }
                });

                table_html += `</tbody></table>`;
                d.$body.find('.drilldown-table-wrapper').html(table_html);
            }
        });
    }

    // --- KPI CARDS — all drilldowns pass metric_type='amount' ---------------
    function render_all_kpi_cards(data) {
        let sysCurrency = frappe.boot.sysdefaults.currency;
        $('#kpi-container').html(`
            <div class="kpi-card" data-method="get_purchase_orders_sql" data-title="Total Purchase Orders" data-metric-type="count" style="border-left: 5px solid #2980b9;">
                <div class="kpi-label">Total Count</div>
                <div class="kpi-value">${data.total_count || 0}</div>
            </div>
            <div class="kpi-card" data-method="get_purchase_orders_sql" data-title="Purchase Order Grand Amount" style="border-left: 5px solid #f39c12;">
                <div class="kpi-label">PO Grand Amount</div>
                <div class="kpi-value">${fmt_currency(data.total_po_amount || 0, sysCurrency)}</div>
            </div>
            <div class="kpi-card" data-method="get_purchase_receipts_sql" data-title="Purchase Receipt Grand Amount" style="border-left: 5px solid #27ae60;">
                <div class="kpi-label">PR Grand Amount</div>
                <div class="kpi-value">${fmt_currency(data.total_pr_amount || 0, sysCurrency)}</div>
            </div>
            <div class="kpi-card" data-method="get_purchase_invoices_sql" data-title="Purchase Invoice Grand Amount" style="border-left: 5px solid #8e44ad;">
                <div class="kpi-label">PI Grand Amount</div>
                <div class="kpi-value">${fmt_currency(data.total_pi_amount || 0, sysCurrency)}</div>
            </div>
        `);

        $('.kpi-card').hover(
            function () { $(this).css('transform', 'translateY(-2px)'); },
            function () { $(this).css('transform', 'translateY(0px)'); }
        );

        // ★ FIX JS-2: read data-metric-type so Count card opens with 'count' metric
        //             (defaults to 'amount' for all other cards)
        $('.kpi-card').off('click').on('click', function () {
            let method = $(this).data('method');
            let title = $(this).data('title');
            let doctype = $(this).data('doctype');
            let metric = $(this).data('metric-type') || 'amount';
            open_drilldown_dialog(title, method, "All", doctype, metric);
        });
    }

    // --- BAR CHARTS ---------------------------------------------------------
    // ★ FIX: explicit client-side sort (descending by value) so ordering
    // never silently depends on however the JSON transport happens to
    // preserve SQL ORDER BY — and so it stays correct after grouping by
    // item_group instead of item_code.
    function render_vertical_bar(elementId, title, categories, values, color, mode, targetMethod) {
        let chartDom = document.getElementById(elementId);
        if (!chartDom) return;

        let paired = categories.map((c, i) => ({ c, v: values[i] }));
        paired.sort((a, b) => b.v - a.v);
        categories = paired.map(p => p.c);
        values = paired.map(p => p.v);

        let myChart = init_chart(elementId);
        if (!myChart) return;
        let option = {
            title: { text: title, left: 'left', textStyle: { fontSize: 14, color: '#34495e' } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: p => `${p[0].name}: <b>${(mode === 'Val') ? fmt_currency(p[0].value, frappe.boot.sysdefaults.currency) : fmt_number(p[0].value, 2)}</b>`
            },
            dataZoom: [
                { type: 'slider', show: true, start: 0, end: Math.min(100, Math.max(10, (10 / (categories.length || 1)) * 100)), bottom: 10 },
                { type: 'inside', start: 0, end: 100 }
            ],
            grid: { left: '4%', right: '4%', bottom: '28%', top: '15%', containLabel: true },
            xAxis: { type: 'category', data: categories, axisLabel: { interval: 0, textStyle: { fontSize: 10 } } },
            yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
            series: [{ type: 'bar', data: values, itemStyle: { color: color, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 }]
        };
        myChart.setOption(option, true);

        myChart.off('click');
        myChart.on('click', function (params) {
            if (params.name) {
                // ★ Bar click → 'qty' for Pending Qty, 'amount' for Balance to Pay
                // ★ context_meta is now 'Item Group' (was 'Item')
                let metric_type = (mode === 'Val') ? 'amount' : 'qty';
                open_drilldown_dialog(title, targetMethod, params.name, 'Item Group', metric_type);
            }
        });
    }

    // --- DONUT CHARTS -------------------------------------------------------
    function render_donut_chart(elementId, title, data, colorPalette, targetMethod) {
        let chartDom = document.getElementById(elementId);
        if (!chartDom) return;
        let myChart = init_chart(elementId);
        if (!myChart) return;
        let option = {
            title: { text: title, left: 'center', textStyle: { fontSize: 14, color: '#34495e' }, top: 5 },
            tooltip: { trigger: 'item', triggerOn: 'mousemove', formatter: '{b} : <b>{c} rows</b> ({d}%)' },
            legend: { orient: 'horizontal', bottom: 0, left: 'center' },
            color: colorPalette,
            series: [{
                type: 'pie', radius: ['40%', '65%'], center: ['50%', '48%'], avoidLabelOverlap: false,
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n({c})' },
                data: data
            }]
        };
        myChart.setOption(option, true);

        myChart.off('click');
        myChart.on('click', function (params) {
            if (params.name) {
                // ★ Donut click → context_meta='Status', metric_type='qty'
                open_drilldown_dialog(title, targetMethod, params.name, 'Status', 'qty');
            }
        });
    }

    // --- FUNNEL -------------------------------------------------------------
    function render_echart(data) {
        let chartDom = document.getElementById('procurement-funnel');
        if (!chartDom) return;
        let myChart = init_chart('procurement-funnel');
        if (!myChart) return;
        let option = {
            title: { text: 'Procurement Funnel', left: 'center', top: 10 },
            tooltip: { trigger: 'item', formatter: p => `${p.name} : <b>${fmt_currency(p.value, frappe.boot.sysdefaults.currency)}</b>` },
            legend: { orient: 'horizontal', bottom: '0%', left: 'center', data: ['Purchase Order', 'Purchase Receipt', 'Purchase Invoice', 'Payment Entry'] },
            series: [{
                name: 'Procurement Stage', type: 'funnel', left: '25%', top: 60, bottom: 80, width: '50%',
                min: 0, minSize: '0%', maxSize: '100%', sort: 'descending', gap: 4,
                label: { show: true, position: 'inside', formatter: p => `${p.name}\n(${fmt_currency(p.value, frappe.boot.sysdefaults.currency)})` },
                itemStyle: { borderColor: '#fff', borderWidth: 2 },
                data: data
            }]
        };
        myChart.setOption(option, true);
    }
};