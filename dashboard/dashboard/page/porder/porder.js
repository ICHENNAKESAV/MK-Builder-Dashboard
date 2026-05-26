frappe.pages['porder'].on_page_load = function(wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Purchase Order Dashboard',
        single_column: true
    });

    $(wrapper).css('padding', '0px');
        
        // 2. Hide the default Frappe Page Head (where the title usually sits)
    $(wrapper).find('.page-head').hide();
        
        // 3. Ensure the body fills the available height
    $(page.body).parent().css('padding', '0px');
    
        // Hide full top navbar
    $('.navbar').hide();
    
        // OR more specific (only container inside navbar)
    $('.navbar .container').hide();
    

    // ─── In-memory stores ────────────────────────────────────────────────────
    // Query-1 result  : PO header rows (no item detail)
    let po_data   = [];
    // Query-2 result  : PO + Item join rows
    let item_data = [];

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY
    // ─────────────────────────────────────────────────────────────────────────
    function format_currency(amount, currency) {
        let symbol = currency || frappe.boot.sysdefaults.currency || '₹';
        let num = parseFloat(amount || 0);
        return symbol + ' ' + num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    let $title_wrapper = $(`
        <div><h2>Purchase Order Dashboard</h2></div>`).appendTo(page.main);
    // ─────────────────────────────────────────────────────────────────────────
    // HORIZONTAL FILTER BAR
    // ─────────────────────────────────────────────────────────────────────────
    let $filter_wrapper = $(`
        <div style="
            padding: 14px 20px;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: flex-end;
        "></div>
    `).appendTo(page.main);

    function make_filter(label, fieldtype, options) {
        let $cell = $(`
            <div style="display:flex; flex-direction:column; min-width:130px; flex:1 1 130px;">
                <label style="
                    font-size:11px;
                    font-weight:600;
                    color:#64748b;
                    margin-bottom:4px;
                    text-transform:uppercase;
                    letter-spacing:.4px;
                ">${label}</label>
            </div>
        `);

        let control;
        if (fieldtype === 'Date') {
            control = frappe.ui.form.make_control({
                df: { fieldtype: 'Date', fieldname: label.toLowerCase().replace(/ /g,'_') },
                parent: $cell[0],
                render_input: true
            });
        } else {
            control = frappe.ui.form.make_control({
                df: { fieldtype: 'Link', options: options, fieldname: label.toLowerCase().replace(/ /g,'_') },
                parent: $cell[0],
                render_input: true
            });
        }
        control.refresh();

        control.df.onchange = function () {
            load_data();
        };

        $filter_wrapper.append($cell);
        return control;
    }

    let ctrl_from_date   = make_filter('From Date',   'Date');
    let ctrl_to_date     = make_filter('To Date',     'Date');
    let ctrl_company     = make_filter('Company',     'Link', 'Company');
    let ctrl_supplier    = make_filter('Supplier',    'Link', 'Supplier');
    let ctrl_item        = make_filter('Item',        'Link', 'Item');
    let ctrl_item_group  = make_filter('Item Group',  'Link', 'Item Group');
    let ctrl_warehouse   = make_filter('Warehouse',   'Link', 'Warehouse');

    

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD HTML SKELETON  (unchanged from original)
    // ─────────────────────────────────────────────────────────────────────────
    let $dash = $(`
        <style>
            .pod { padding:18px; background:#f1f5f9; }

            .pod-kpi-row { display:flex; flex-wrap:wrap; gap:14px; margin-bottom:18px; }
            .pod-kpi {
                flex:1 1 160px;
                background:#fff;
                border-radius:10px;
                padding:16px 20px;
                box-shadow:0 1px 4px rgba(0,0,0,.07);
                cursor:pointer;
                transition:transform .15s, box-shadow .15s;
                border-top:3px solid transparent;
            }
            .pod-kpi:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.12); }
            .pod-kpi.no-click { cursor:default; }
            .pod-kpi.no-click:hover { transform:none; box-shadow:0 1px 4px rgba(0,0,0,.07); }
            .pod-kpi-label {
                font-size:10.5px;
                font-weight:700;
                text-transform:uppercase;
                letter-spacing:.6px;
                color:#94a3b8;
                margin-bottom:6px;
            }
            .pod-kpi-value { font-size:22px; font-weight:800; color:#0f172a; }

            .pod-card {
                background:#fff;
                border-radius:10px;
                box-shadow:0 1px 4px rgba(0,0,0,.07);
                margin-bottom:18px;
                overflow:hidden;
            }
            .pod-card-head {
                padding:14px 18px 10px;
                font-size:13px;
                font-weight:700;
                color:#1e293b;
                border-bottom:1px solid #f1f5f9;
                display:flex;
                align-items:center;
                gap:8px;
            }
            .pod-card-head i { color:#6366f1; }
            .pod-card-body { padding:16px 18px; }
            .pod-chart { width:100%; height:300px; }

            .pod-row { display:flex; flex-wrap:wrap; gap:18px; margin-bottom:0; }
            .pod-col-12 { flex:1 1 100%; }
            .pod-col-6  { flex:1 1 calc(50% - 9px); min-width:280px; }

            /* ── Drill-down Modal ── */
            .dd-wrap {
                max-height:460px;
                overflow-y:auto;
                border-radius:8px;
                border:1px solid #e2e8f0;
            }
            .dd-table {
                width:100%;
                border-collapse:collapse;
                font-size:12.5px;
            }
            .dd-table thead tr {
                background:#f8fafc;
                position:sticky;
                top:0;
                z-index:5;
            }
            .dd-table thead th {
                padding:10px 12px;
                text-align:left;
                font-weight:700;
                color:#475569;
                font-size:11px;
                text-transform:uppercase;
                letter-spacing:.5px;
                border-bottom:2px solid #e2e8f0;
                white-space:nowrap;
            }
            .dd-table thead th.text-right  { text-align:right; }
            .dd-table thead th.text-center { text-align:center; }
            .dd-table tbody tr { border-bottom:1px solid #f1f5f9; transition:background .1s; }
            .dd-table tbody tr:hover { background:#f8fafc; }
            .dd-table tbody td { padding:9px 12px; color:#334155; vertical-align:middle; }
            .dd-table tbody td.text-right  { text-align:right; font-variant-numeric:tabular-nums; }
            .dd-table tbody td.text-center { text-align:center; }
            .dd-table .dd-link {
                color:#4f46e5;
                font-weight:600;
                text-decoration:none;
            }
            .dd-table .dd-link:hover { text-decoration:underline; }
            .dd-badge {
                display:inline-block;
                padding:2px 9px;
                border-radius:99px;
                font-size:11px;
                font-weight:600;
                white-space:nowrap;
            }
            .dd-badge.green  { background:#dcfce7; color:#16a34a; }
            .dd-badge.orange { background:#fff7ed; color:#ea580c; }
            .dd-badge.red    { background:#fee2e2; color:#dc2626; }
            .dd-badge.blue   { background:#eff6ff; color:#2563eb; }
            .dd-badge.gray   { background:#f1f5f9; color:#475569; }
            .dd-summary {
                padding:10px 14px;
                background:#f8fafc;
                border-top:1px solid #e2e8f0;
                font-size:12px;
                color:#64748b;
                display:flex;
                justify-content:space-between;
            }
        </style>

        <div class="pod">
            <!-- KPIs -->
            <div class="pod-kpi-row" id="pod_kpis"></div>

            <!-- Monthly Trend (full width) -->
            <div class="pod-card">
                <div class="pod-card-head"><i class="fa fa-line-chart"></i> Monthly Purchase Order Trend</div>
                <div class="pod-card-body"><div id="pod_monthly" class="pod-chart"></div></div>
            </div>

            <!-- Row 1 -->
            <div class="pod-row">
                <div class="pod-col-6 pod-card">
                    <div class="pod-card-head"><i class="fa fa-building"></i> Company-wise Distribution</div>
                    <div class="pod-card-body"><div id="pod_company" class="pod-chart"></div></div>
                </div>
                <div class="pod-col-6 pod-card">
                    <div class="pod-card-head"><i class="fa fa-truck"></i> Top Suppliers</div>
                    <div class="pod-card-body"><div id="pod_supplier" class="pod-chart"></div></div>
                </div>
            </div>

            <!-- Row 2 -->
            <div class="pod-row">
                <div class="pod-col-6 pod-card">
                    <div class="pod-card-head"><i class="fa fa-pie-chart"></i> Cost Centre Shares</div>
                    <div class="pod-card-body"><div id="pod_cost_center" class="pod-chart"></div></div>
                </div>
                <div class="pod-col-6 pod-card">
                    <div class="pod-card-head"><i class="fa fa-check-circle"></i> Order Status Breakdown</div>
                    <div class="pod-card-body"><div id="pod_status" class="pod-chart"></div></div>
                </div>
            </div>

            <!-- Row 3 -->
            <div class="pod-row">
                <div class="pod-col-6 pod-card">
                    <div class="pod-card-head"><i class="fa fa-database"></i> Warehouse Allocation</div>
                    <div class="pod-card-body"><div id="pod_warehouse" class="pod-chart"></div></div>
                </div>
                <div class="pod-col-6 pod-card">
                    <div class="pod-card-head"><i class="fa fa-tags"></i> Item Group Spend</div>
                    <div class="pod-card-body"><div id="pod_item_group" class="pod-chart"></div></div>
                </div>
            </div>

            <!-- Row 4 (full width) -->
            <div class="pod-card">
                <div class="pod-card-head"><i class="fa fa-cube"></i> Item-level Metrics</div>
                <div class="pod-card-body"><div id="pod_items" class="pod-chart" style="height:340px;"></div></div>
            </div>
        </div>
    `).appendTo(page.main);

    // ─────────────────────────────────────────────────────────────────────────
    // CHART ID MAP
    // ─────────────────────────────────────────────────────────────────────────
    const CHART_IDS = [
        'pod_monthly','pod_company','pod_supplier','pod_cost_center',
        'pod_status','pod_warehouse','pod_item_group','pod_items'
    ];

    function dispose_charts() {
        CHART_IDS.forEach(id => {
            let el = document.getElementById(id);
            if (el) { let inst = echarts.getInstanceByDom(el); if (inst) inst.dispose(); }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FILTERS
    // ─────────────────────────────────────────────────────────────────────────
    function get_filter_values() {
        return {
            from_date:   ctrl_from_date.get_value()   || null,
            to_date:     ctrl_to_date.get_value()     || null,
            company:     ctrl_company.get_value()     || null,
            supplier:    ctrl_supplier.get_value()    || null,
            item:        ctrl_item.get_value()        || null,
            item_group:  ctrl_item_group.get_value()  || null,
            warehouse:   ctrl_warehouse.get_value()   || null,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA LOADER  — fires two parallel API calls
    // ─────────────────────────────────────────────────────────────────────────
    function load_data() {
        dispose_charts();
        let filters = get_filter_values();

        // Use Promise.all so both calls run in parallel
        let call_po = new Promise((resolve, reject) => {
            frappe.call({
                method: "dashboard.dashboard.page.porder.porder.get_purchase_orders",
                args: { filters },
                callback: r => resolve(r.message || []),
                error:    reject
            });
        });

        let call_items = new Promise((resolve, reject) => {
            frappe.call({
                method: "dashboard.dashboard.page.porder.porder.get_purchase_order_items",
                args: { filters },
                callback: r => resolve(r.message || []),
                error:    reject
            });
        });

        // Show Frappe's freeze manually since we're not using its freeze option

        Promise.all([call_po, call_items])
            .then(([po_rows, item_rows]) => {
                po_data   = po_rows;
                item_data = item_rows;

                if (!po_data.length && !item_data.length) {
                    $('#pod_kpis').html(`
                        <div style="width:100%;">
                            <div class="alert alert-warning text-center" style="margin:0;">
                                No records found for the selected filters.
                            </div>
                        </div>
                    `);
                    return;
                }

                // ── Aggregations from Query-1 (PO header) ────────────────────
                let total_amount = 0, pending_bill = 0, pending_recv = 0, pending_both = 0;
                let monthlyMap = {}, companyMap = {}, supplierMap = {}, costCenterMap = {}, statusMap = {};

                po_data.forEach(row => {
                    let amt = Number(row.grand_total || 0);
                    total_amount += amt;

                    let st = (row.status || '').trim();
                    if (st === 'To Bill')                                    pending_bill++;
                    if (st === 'To Receive')                                 pending_recv++;
                    if (st === 'To Receive and Bill' ||
                        st === 'To Bill and Receive')                        pending_both++;

                    let monthKey = 'Unknown';
                    if (row.transaction_date) {
                        let parts = String(row.transaction_date).split('-');
                        if (parts.length === 3) monthKey = `${parts[0]}-${parts[1]}`;
                    }
                    monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + amt;

                    let comp = row.company  || 'Unassigned';
                    companyMap[comp] = (companyMap[comp] || 0) + amt;

                    let supp = row.supplier || 'Unassigned';
                    if (!supplierMap[supp]) supplierMap[supp] = { amount:0, qty:0 };
                    supplierMap[supp].amount += amt;
                    supplierMap[supp].qty    += Number(row.total_qty || 0);

                    let cc = row.cost_center || 'Unassigned';
                    costCenterMap[cc] = (costCenterMap[cc] || 0) + amt;

                    let stat = row.status || 'Unknown';
                    statusMap[stat] = (statusMap[stat] || 0) + 1;
                });

                // ── Aggregations from Query-2 (item-level) ───────────────────
                let warehouseMap = {}, itemGroupMap = {}, itemsMap = {};

                item_data.forEach(row => {
                    let amt = Number(row.amount || 0);
                    let qty = Number(row.qty    || 0);

                    let wh = row.warehouse  || 'Unassigned';
                    if (!warehouseMap[wh]) warehouseMap[wh] = { amount:0, qty:0 };
                    warehouseMap[wh].amount += amt;
                    warehouseMap[wh].qty    += qty;

                    let ig = row.item_group || 'Unassigned';
                    if (!itemGroupMap[ig]) itemGroupMap[ig] = { amount:0, qty:0 };
                    itemGroupMap[ig].amount += amt;
                    itemGroupMap[ig].qty    += qty;

                    let itm = row.item_code || 'Unassigned';
                    if (!itemsMap[itm]) itemsMap[itm] = { amount:0, qty:0 };
                    itemsMap[itm].amount += amt;
                    itemsMap[itm].qty    += qty;
                });

                // ── Render ───────────────────────────────────────────────────
                render_kpis({ total_po: po_data.length, total_amount, pending_bill, pending_recv, pending_both });
                render_monthly_trend(monthlyMap);
                render_company_chart(companyMap);
                render_supplier_chart(supplierMap);
                render_cost_center_chart(costCenterMap);
                render_status_chart(statusMap);
                render_warehouse_chart(warehouseMap);
                render_item_group_chart(itemGroupMap);
                render_items_chart(itemsMap);
            })
            .catch(err => {
                frappe.msgprint(__('Error loading dashboard data. Please check the console.'));
                console.error(err);
            });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRILL-DOWN HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    function status_badge(status) {
        let cls = 'gray';
        let s = (status || '').toLowerCase();
        if (s === 'completed')                          cls = 'green';
        else if (s === 'draft')                         cls = 'red';
        else if (s.includes('bill') || s.includes('receive')) cls = 'orange';
        else if (s === 'submitted')                     cls = 'blue';
        return `<span class="dd-badge ${cls}">${status || '—'}</span>`;
    }

    // ── PO-level drill-down (Monthly, Company, Supplier, Cost Centre, Status) ─
    function open_po_drill_down(filter_key, clicked_value) {
        let records = po_data.filter(row => {
            if (filter_key === 'transaction_date') {
                if (!row.transaction_date) return false;
                let p = String(row.transaction_date).split('-');
                return p.length === 3 && `${p[0]}-${p[1]}` === clicked_value;
            }
            return String(row[filter_key] || 'Unassigned').trim() === String(clicked_value).trim();
        });

        let total_shown = format_currency(
            records.reduce((s, r) => s + Number(r.grand_total || 0), 0),
            records[0] && records[0].currency
        );

        let rows_html = records.length
            ? records.map((row, i) => `
                <tr>
                    <td style="color:#94a3b8; width:36px;">${i + 1}</td>
                    <td>
                        <a class="dd-link"
                           href="/app/purchase-order/${row.name}"
                           target="_blank">${row.name}</a>
                    </td>
                    <td>${frappe.datetime.str_to_user(row.transaction_date) || '—'}</td>
                    <td>${frappe.datetime.str_to_user(row.schedule_date) || '—'}</td>
                    <td>${row.supplier || '—'}</td>
                    <td>${row.company  || '—'}</td>
                    <td>${row.cost_center || '—'}</td>
                    <td>${row.supplier_qutation_no_ || '—'}</td>
                    <td>${frappe.datetime.str_to_user(row.supplier_quotation_date) || '—'}</td>
                    <td>${row.set_warehouse || '—'}</td>
                    <td class="text-right">${Number(row.total_qty || 0).toLocaleString('en-IN')}</td>
                    <td class="text-right">${format_currency(row.grand_total, row.currency)}</td>
                    <td class="text-center">${status_badge(row.status)}</td>
                </tr>
            `).join('')
            : `<tr><td colspan="13" style="text-align:center; padding:24px; color:#94a3b8;">No records found.</td></tr>`;

        let dialog_html = `
            <div class="dd-wrap">
                <table class="dd-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>PO Reference</th>
                            <th>PO Date</th>
                            <th>Schedule Date</th>
                            <th>Supplier</th>
                            <th>Company</th>
                            <th>Cost Centre</th>
                            <th>Supplier Quotation No</th>
                            <th>Supplier Quotation Date</th>
                            <th>Warehouse</th>
                            <th class="text-right">Total Qty</th>
                            <th class="text-right">Grand Total</th>
                            <th class="text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rows_html}</tbody>
                </table>
            </div>
            <div class="dd-summary">
                <span><b>${records.length}</b> order${records.length !== 1 ? 's' : ''}</span>
                <span>Total: <b>${total_shown}</b></span>
            </div>
        `;

        let modal = new frappe.ui.Dialog({
            title: `Purchase Orders — ${clicked_value}`,
            size: 'extra-large',
            fields: [{ fieldtype: 'HTML', fieldname: 'dd_content' }]
        });
        modal.fields_dict.dd_content.$wrapper.html(dialog_html);
        modal.show();
    }

    // ── Item-level drill-down (Warehouse, Item Group, Item) ──────────────────
    function open_item_drill_down(filter_key, clicked_value) {
        let records = item_data.filter(row =>
            String(row[filter_key] || 'Unassigned').trim() === String(clicked_value).trim()
        );

        let total_amt = records.reduce((s, r) => s + Number(r.amount || 0), 0);
        let total_qty = records.reduce((s, r) => s + Number(r.qty    || 0), 0);

        let rows_html = records.length
            ? records.map((row, i) => `
                <tr>
                    <td style="color:#94a3b8; width:36px;">${i + 1}</td>
                    <td>
                        <a class="dd-link"
                           href="/app/purchase-order/${row.name}"
                           target="_blank">${row.name}</a>
                    </td>
                    <td>${frappe.datetime.str_to_user(row.transaction_date) || '—'}</td>
                    <td>${frappe.datetime.str_to_user(row.schedule_date) || '—'}</td>
                    <td>${row.supplier || '—'}</td>
                    <td>${row.company  || '—'}</td>
                    <td>${row.supplier_qutation_no_ || '—'}</td>
                    <td>${frappe.datetime.str_to_user(row.supplier_quotation_date) || '—'}</td>
                    <td>${row.item_code || '—'}</td>
                    <td>${row.item_name || '—'}</td>
                    <td>${row.item_group || '—'}</td>
                    <td class="text-right">${Number(row.qty || 0).toLocaleString('en-IN')}</td>
                    <td class="text-right">${Number(row.received_qty || 0).toLocaleString('en-IN')}</td>
                    <td class="text-right">${format_currency(row.rate)}</td>
                    <td class="text-right">${format_currency(row.amount)}</td>
                    <td>${frappe.datetime.str_to_user(row.item_schedule_date) || '—'}</td>
                    <td>${row.warehouse || '—'}</td>
                    <td class="text-center">${status_badge(row.status)}</td>
                </tr>
            `).join('')
            : `<tr><td colspan="18" style="text-align:center; padding:24px; color:#94a3b8;">No records found.</td></tr>`;

        let dialog_html = `
            <div class="dd-wrap">
                <table class="dd-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>PO Reference</th>
                            <th>PO Date</th>
                            <th>Schedule Date</th>
                            <th>Supplier</th>
                            <th>Company</th>
                            <th>Supplier Quotation No</th>
                            <th>Supplier Quotation Date</th>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Item Group</th>
                            <th class="text-right">Qty</th>
                            <th class="text-right">Received Qty</th>
                            <th class="text-right">Rate</th>
                            <th class="text-right">Amount</th>
                            <th>Item Schedule Date</th>
                            <th>Warehouse</th>
                            <th class="text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rows_html}</tbody>
                </table>
            </div>
            <div class="dd-summary">
                <span><b>${records.length}</b> line${records.length !== 1 ? 's' : ''}</span>
                <span>Qty: <b>${total_qty.toLocaleString('en-IN')}</b> &nbsp;|&nbsp; Amount: <b>${format_currency(total_amt)}</b></span>
            </div>
        `;

        let modal = new frappe.ui.Dialog({
            title: `Items — ${clicked_value}`,
            size: 'extra-large',
            fields: [{ fieldtype: 'HTML', fieldname: 'dd_content' }]
        });
        modal.fields_dict.dd_content.$wrapper.html(dialog_html);
        modal.show();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KPI CARDS  (unchanged logic, uses po_data)
    // ─────────────────────────────────────────────────────────────────────────
    function render_kpis(d) {
        const ACCENT = ['#6366f1','#f59e0b','#10b981','#f43f5e','#0ea5e9'];
        let cards = [
            { label:'Total Orders',    value: d.total_po,                      key:null,     filter:null },
            { label:'Pending Billing', value: d.pending_bill,                  key:'status', filter:'To Bill' },
            { label:'Pending Receipt', value: d.pending_recv,                  key:'status', filter:'To Receive' },
            { label:'Pending Both',    value: d.pending_both,                  key:'status', filter:'To Receive and Bill' },
            { label:'Total Value',     value: format_currency(d.total_amount), key:null,     filter:null },
        ];

        $('#pod_kpis').html(
            cards.map((c, i) => `
                <div class="pod-kpi ${c.key ? '' : 'no-click'}"
                     id="kpi_${i}"
                     style="border-top-color:${ACCENT[i]}">
                    <div class="pod-kpi-label">${c.label}</div>
                    <div class="pod-kpi-value">${c.value}</div>
                </div>
            `).join('')
        );

        cards.forEach((c, i) => {
            if (c.key) {
                $(`#kpi_${i}`).on('click', () => open_po_drill_down(c.key, c.filter));
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHART RENDERERS  (identical options to original, drill-down updated)
    // ─────────────────────────────────────────────────────────────────────────
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function ec(id) { return echarts.init(document.getElementById(id)); }

    function common_grid(opts) {
        return Object.assign({ bottom:'18%', top:'12%', left:'12%', right:'4%' }, opts);
    }

    // Monthly Trend → PO drill-down
    function render_monthly_trend(map) {
        let keys = Object.keys(map).filter(k => k !== 'Unknown').sort();
        if (map['Unknown']) keys.push('Unknown');

        let labels = keys.map(k => {
            if (k === 'Unknown') return 'Unknown';
            let [yr, mo] = k.split('-');
            return `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
        });

        let chart = ec('pod_monthly');
        chart.setOption({
            tooltip: { trigger:'axis', formatter: p => `${p[0].name}<br/><b>${format_currency(p[0].value)}</b>` },
            grid: common_grid(),
            xAxis: { type:'category', data: labels, axisLabel:{ rotate:0 } },
            yAxis: { type:'value', axisLabel:{ formatter: v => (v/1000).toFixed(0)+'K' } },
            series: [{
                type:'line', smooth:true,
                data: keys.map(k => map[k]),
                areaStyle:{ color:'rgba(99,102,241,.12)' },
                itemStyle:{ color:'#6366f1' },
                lineStyle:{ width:2.5 }
            }]
        });
        chart.on('click', p => open_po_drill_down('transaction_date', keys[p.dataIndex]));
    }

    // Company → PO drill-down
    function render_company_chart(map) {
        let keys = Object.keys(map), vals = Object.values(map);
        let chart = ec('pod_company');
        chart.setOption({
            tooltip: { trigger:'axis', formatter: p => `${p[0].name}<br/><b>${format_currency(p[0].value)}</b>` },
            grid: common_grid(),
            xAxis: { type:'category', data:keys, axisLabel:{ rotate:0 } },
            yAxis: { type:'value', axisLabel:{ formatter: v => (v/1000).toFixed(0)+'K' } },
            series: [{ type:'bar', data:vals, itemStyle:{ color:'#0ea5e9', borderRadius:[4,4,0,0] } }]
        });
        chart.on('click', p => open_po_drill_down('company', p.name));
    }

    // Supplier → PO drill-down
    function render_supplier_chart(map) {
        let supps = Object.keys(map).sort((a,b) => map[b].amount - map[a].amount).slice(0,12);
        let chart = ec('pod_supplier');
        chart.setOption({
            tooltip: { trigger:'axis' },
            legend: { data:['Amount','Qty'] },
            grid: common_grid({ top:'16%', right:'10%' }),
            xAxis: { type:'category', data:supps, axisLabel:{ rotate:0 } },
            yAxis: [
                { type:'value', name:'Amount', axisLabel:{ formatter: v => (v/1000).toFixed(0)+'K' } },
                { type:'value', name:'Qty' }
            ],
            series: [
                { name:'Amount', type:'bar', data:supps.map(s => map[s].amount), itemStyle:{ color:'#6366f1', borderRadius:[4,4,0,0] } },
                { name:'Qty',    type:'bar', data:supps.map(s => map[s].qty),    itemStyle:{ color:'#f43f5e', borderRadius:[4,4,0,0] } }
            ]
        });
        chart.on('click', p => open_po_drill_down('supplier', p.name));
    }

    // Cost Centre → PO drill-down
    function render_cost_center_chart(map) {
        let keys = Object.keys(map), vals = Object.values(map);
        let chart = ec('pod_cost_center');
        chart.setOption({
            tooltip: { trigger:'axis', formatter: p => `${p[0].name}<br/><b>${format_currency(p[0].value)}</b>` },
            grid: common_grid(),
            xAxis: { type:'category', data:keys, axisLabel:{ rotate:0 } },
            yAxis: { type:'value', axisLabel:{ formatter: v => (v/1000).toFixed(0)+'K' } },
            series: [{ type:'bar', data:vals, itemStyle:{ color:'#10b981', borderRadius:[4,4,0,0] } }]
        });
        chart.on('click', p => open_po_drill_down('cost_center', p.name));
    }

    // Status → PO drill-down
    function render_status_chart(map) {
        const COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#0ea5e9','#8b5cf6'];
        let chart = ec('pod_status');
        chart.setOption({
            tooltip: { trigger:'item', formatter:'{b}: {c} ({d}%)' },
            legend: { orient:'vertical', right:10 },
            series: [{
                type:'pie',
                radius:['40%','70%'],
                center:['40%','50%'],
                data: Object.keys(map).map((k,i) => ({
                    name:k, value:map[k], itemStyle:{ color:COLORS[i % COLORS.length] }
                })),
                label:{ show:true, formatter:'{b}\n{c}' },
                emphasis:{ itemStyle:{ shadowBlur:8, shadowColor:'rgba(0,0,0,.15)' } }
            }]
        });
        chart.on('click', p => open_po_drill_down('status', p.name));
    }

    // Warehouse → Item drill-down
    function render_warehouse_chart(map) {
        let whs = Object.keys(map);
        let chart = ec('pod_warehouse');
        chart.setOption({
            tooltip: { trigger:'axis' },
            legend: { data:['Amount','Qty'] },
            grid: common_grid({ top:'16%', right:'10%' }),
            xAxis: { type:'category', data:whs, axisLabel:{ rotate:0 } },
            yAxis: [
                { type:'value', name:'Amount', axisLabel:{ formatter: v => (v/1000).toFixed(0)+'K' } },
                { type:'value', name:'Qty' }
            ],
            series: [
                { name:'Amount', type:'bar', data:whs.map(w => map[w].amount), itemStyle:{ color:'#f59e0b', borderRadius:[4,4,0,0] } },
                { name:'Qty',    type:'bar', data:whs.map(w => map[w].qty),    itemStyle:{ color:'#14b8a6', borderRadius:[4,4,0,0] } }
            ]
        });
        chart.on('click', p => open_item_drill_down('warehouse', p.name));
    }

    // Item Group → Item drill-down
    function render_item_group_chart(map) {
        let igs = Object.keys(map);
        let chart = ec('pod_item_group');
        chart.setOption({
            tooltip: { trigger:'axis' },
            legend: { data:['Amount','Qty'] },
            grid: common_grid({ top:'16%', right:'10%' }),
            xAxis: { type:'category', data:igs, axisLabel:{ rotate:0 } },
            yAxis: [
                { type:'value', name:'Amount', axisLabel:{ formatter: v => (v/1000).toFixed(0)+'K' } },
                { type:'value', name:'Qty' }
            ],
            series: [
                { name:'Amount', type:'bar', data:igs.map(i => map[i].amount), itemStyle:{ color:'#8b5cf6', borderRadius:[4,4,0,0] } },
                { name:'Qty',    type:'bar', data:igs.map(i => map[i].qty),    itemStyle:{ color:'#ec4899', borderRadius:[4,4,0,0] } }
            ]
        });
        chart.on('click', p => open_item_drill_down('item_group', p.name));
    }

    // Item → Item drill-down
    function render_items_chart(map) {
        let items = Object.keys(map).sort((a,b) => map[b].amount - map[a].amount).slice(0, 20);
        let chart = ec('pod_items');
        chart.setOption({
            tooltip: { trigger:'axis' },
            legend: { data:['Amount','Qty'] },
            grid: { bottom:'28%', top:'14%', left:'12%', right:'10%' },
            xAxis: { type:'category', data:items, axisLabel:{ rotate:0 } },
            yAxis: [
                { type:'value', name:'Amount', axisLabel:{ formatter: v => (v/1000).toFixed(0)+'K' } },
                { type:'value', name:'Qty' }
            ],
            series: [
                { name:'Amount', type:'bar', data:items.map(i => map[i].amount), itemStyle:{ color:'#3b82f6', borderRadius:[4,4,0,0] } },
                { name:'Qty',    type:'bar', data:items.map(i => map[i].qty),    itemStyle:{ color:'#10b981', borderRadius:[4,4,0,0] } }
            ]
        });
        chart.on('click', p => open_item_drill_down('item_code', p.name));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INITIAL LOAD
    // ─────────────────────────────────────────────────────────────────────────
    setTimeout(load_data, 300);
};