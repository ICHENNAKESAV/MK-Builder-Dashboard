frappe.pages['procurement'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Interactive Procurement Dashboard',
        single_column: true
    });
    
    // Scoped CSS resets
    $(wrapper).css('padding', '0px');
    $(wrapper).find('.page-head').hide();
    $(page.body).parent().css('padding', '0px');

    // Build structural dashboard blueprint with Conversion Funnel at the bottom
    $(page.body).html(`
        <div style="padding: 25px; background-color: #f8f9fa; min-height: 100vh; font-family: sans-serif;">
            
            <div id="dashboard-filter-bar" style="background: #fff; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 25px; display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end;"></div>

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

    // Global filters state tracker container
    let current_filters = {
        supplier: "",
        from_date: "",
        to_date: "",
        project: "",
        company: "",
        item_code: ""
    };

    // Instantiate Interactive Filter Inputs
    let fields = [
        { fieldname: 'company', label: __('Company'), fieldtype: 'Link', options: 'Company' },
        { fieldname: 'supplier', label: __('Supplier'), fieldtype: 'Link', options: 'Supplier' },
        { fieldname: 'item_code', label: __('Item'), fieldtype: 'Link', options: 'Item' },
        { fieldname: 'project', label: __('Project'), fieldtype: 'Link', options: 'Project' },
        { fieldname: 'from_date', label: __('From Date'), fieldtype: 'Date' },
        { fieldname: 'to_date', label: __('To Date'), fieldtype: 'Date' }
    ];

    fields.forEach(f => {
        let field_wrapper = $(`<div style="flex: 1; min-width: 160px;">
            <label style="font-size: 12px; color: #7f8c8d; font-weight: 600; margin-bottom: 5px; display:block;">${f.label}</label>
            <div class="filter-input-${f.fieldname}"></div>
        </div>`).appendTo('#dashboard-filter-bar');

        frappe.ui.form.make_control({
            df: {
                fieldtype: f.fieldtype,
                fieldname: f.fieldname,
                options: f.options,
                only_select: true,
                change: function() {
                    current_filters[f.fieldname] = this.get_value() || "";
                    trigger_dashboard_refresh();
                }
            },
            parent: field_wrapper.find(`.filter-input-${f.fieldname}`),
            render_input: true
        });
    });

    // Master operational reload pipeline orchestration method
    function trigger_dashboard_refresh() {
        let kpi_data = {
            total_count: 0, total_qty: 0, total_amount: 0,
            total_received_qty: 0, total_pending_qty: 0,
            total_paid_amount: 0, total_balance_to_pay: 0
        };

        let data_waitlist = { 
            kpis_from_po: false, kpis_from_items: false, kpis_from_pending: false,
            kpis_from_payments: false, kpis_from_balance: false
        };

        function check_and_render_kpis() {
            if (data_waitlist.kpis_from_po && data_waitlist.kpis_from_items && 
                data_waitlist.kpis_from_pending && data_waitlist.kpis_from_payments && data_waitlist.kpis_from_balance) {
                render_all_kpi_cards(kpi_data);
            }
        }

        // --- 1. PURCHASE ORDERS METRICS ---
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_purchase_orders_sql",
            args: { filters: current_filters },
            callback: function(r) {
                if (r.message && r.message.length) {
                    kpi_data.total_count = r.message.length;
                    r.message.forEach(po => {
                        kpi_data.total_qty += flt(po.ordered_qty);
                        kpi_data.total_amount += flt(po.ordered_amount);
                    });
                }
                data_waitlist.kpis_from_po = true;
                check_and_render_kpis();
            }
        });

        // --- 2. RECEIVED QUANTITIES METRICS ---
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_po_item_status",
            args: { filters: current_filters },
            callback: function(r) {
                if (r.message && r.message.length) {
                    r.message.forEach(row => { kpi_data.total_received_qty += flt(row.received_qty); });
                }
                data_waitlist.kpis_from_items = true;
                check_and_render_kpis();
            }
        });

        // --- 3. PENDING QUANTITIES VARIABLE COLUMN BARS ---
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_pending_items_sql",
            args: { filters: current_filters },
            callback: function(r) {
                let pending_items_map = {};
                if (r.message && r.message.length) {
                    r.message.forEach(item => {
                        kpi_data.total_pending_qty += flt(item.pending_qty);
                        let code = item.item_code || "Unknown";
                        pending_items_map[code] = (pending_items_map[code] || 0) + flt(item.pending_qty);
                    });
                }
                data_waitlist.kpis_from_pending = true;
                check_and_render_kpis();

                let sortedPending = Object.entries(pending_items_map).sort((a, b) => b[1] - a[1]);
                render_vertical_bar('item-pending-bar', 'Pending Qty by Item', sortedPending.map(x => x[0]), sortedPending.map(x => x[1]), '#e74c3c', 'Qty', 'get_pending_items_sql');
            }
        });

        // --- 4. HISTORICAL PAID LEDGER ENTRIES ---
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_invoice_payments_sql",
            args: { filters: current_filters },
            callback: function(r) {
                if (r.message && r.message.length) {
                    r.message.forEach(pmt => { kpi_data.total_paid_amount += flt(pmt.paid_amount); });
                }
                data_waitlist.kpis_from_payments = true;
                check_and_render_kpis();
            }
        });

        // --- 5. OUTSTANDING EXPOSURE COLUMN BARS ---
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_balance_to_pay_sql",
            args: { filters: current_filters },
            callback: function(r) {
                let item_exposure_map = {};
                if (r.message && r.message.length) {
                    r.message.forEach(row => {
                        kpi_data.total_balance_to_pay += flt(row.balance_to_pay);
                        if (row.items) {
                            let attached_items = row.items.split(',').map(i => i.trim());
                            let split_weight = flt(row.balance_to_pay) / (attached_items.length || 1);
                            attached_items.forEach(item_name => {
                                if (item_name) item_exposure_map[item_name] = (item_exposure_map[item_name] || 0) + split_weight;
                            });
                        }
                    });
                }
                data_waitlist.kpis_from_balance = true;
                check_and_render_kpis();

                let sortedExposure = Object.entries(item_exposure_map).sort((a, b) => b[1] - a[1]);
                render_vertical_bar('item-balance-bar', 'Financial Balance to Pay by Item', sortedExposure.map(x => x[0]), sortedExposure.map(x => x[1]), '#d35400', 'Val', 'get_balance_to_pay_sql');
            }
        });

        // --- 6. PROCESS REFRESH: RECEIPT STATUS BREAKDOWN DONUT ---
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_po_receipt_status_sql",
            args: { filters: current_filters },
            callback: function(r) {
                let counts = { 'Not Received': 0, 'Partially Received': 0, 'Fully Received': 0 };
                if (r.message && r.message.length) {
                    r.message.forEach(row => { if (counts[row.receipt_status] !== undefined) counts[row.receipt_status]++; });
                }
                render_donut_chart('receipt-status-donut', 'Items Receipt Status Breakdown', Object.entries(counts).map(([name, value]) => ({ name, value })), ['#95a5a6', '#f1c40f', '#2ecc71'], 'get_po_receipt_status_sql');
            }
        });

        // --- 7. PROCESS REFRESH: INVOICE STATUS BREAKDOWN DONUT ---
        frappe.call({
            method: "dashboard.dashboard.page.procurement.procurement.get_po_invoice_status_sql",
            args: { filters: current_filters },
            callback: function(r) {
                let counts = { 'Not Billed': 0, 'Partially Billed': 0, 'Fully Billed': 0 };
                if (r.message && r.message.length) {
                    r.message.forEach(row => { if (counts[row.invoice_status] !== undefined) counts[row.invoice_status]++; });
                }
                render_donut_chart('invoice-status-donut', 'Items Billing Status Breakdown', Object.entries(counts).map(([name, value]) => ({ name, value })), ['#7f8c8d', '#e67e22', '#3498db'], 'get_po_invoice_status_sql');
            }
        });
    }

    // --- 8. INITIALIZE SYSTEM STATIC GLOBAL CONVERSION FUNNEL ---
    frappe.call({
        method: "dashboard.dashboard.page.procurement.procurement.get_sum", 
        callback: function(r) {
            if (!r.message) return;
            render_echart([
                { name: "Purchase Order", value: r.message.purchase_order || 0 },
                { name: "Purchase Receipt", value: r.message.purchase_receipt || 0 },
                { name: "Purchase Invoice", value: r.message.purchase_invoice || 0 },
                { name: "Payment Entry", value: r.message.payment_entry || 0 }
            ]);
        }
    });

    trigger_dashboard_refresh();

    // --- DRILL DOWN POPUP WINDOW GENERATOR ENGINE ---
    function open_drilldown_dialog(title, method_name, clicked_key, clicked_value) {
        let temp_filters = Object.assign({}, current_filters);
        
        if ((method_name === 'get_pending_items_sql' || method_name === 'get_balance_to_pay_sql') && clicked_key !== "All") {
            temp_filters['item_code'] = clicked_key;
        }

        let d = new frappe.ui.Dialog({
            title: clicked_key === "All" ? `${title} Metrics Summary` : `${title} Details : ${clicked_key}`,
            size: 'large',
            no_focus: true
        });

        d.$body.html(`
            <div class="drilldown-loading" style="text-align:center; padding: 40px; color:#7f8c8d;">
                <i class="fa fa-spinner fa-spin fa-2x" style="margin-bottom: 10px; display: block; color: #1abc9c;"></i>
                Fetching document records...
            </div>
            <div class="drilldown-table-wrapper" style="padding: 10px; max-height: 450px; overflow-y: auto;"></div>
        `);
        d.show();

        frappe.call({
            method: `dashboard.dashboard.page.procurement.procurement.${method_name}`,
            args: { filters: temp_filters },
            callback: function(res) {
                d.$body.find('.drilldown-loading').remove();
                let records = res.message || [];
                
                if (clicked_key !== "All") {
                    if (method_name === 'get_po_receipt_status_sql') {
                        records = records.filter(x => x.receipt_status === clicked_key);
                    } else if (method_name === 'get_po_invoice_status_sql') {
                        records = records.filter(x => x.invoice_status === clicked_key);
                    }
                }

                if (!records.length) {
                    d.$body.find('.drilldown-table-wrapper').html(`<div style="text-align:center; padding: 30px; color: #7f8c8d;">No matching active document tracks found.</div>`);
                    return;
                }

                let sysCurrency = frappe.boot.sysdefaults.currency;
                
                let table_html = `
                    <table class="table table-bordered table-condensed table-hover" style="font-size: 13px; background:#fff; margin-bottom: 0px;">
                        <thead>
                            <tr style="background-color: #f3f4f6; color: #34495e; font-weight: bold;">
                                <th style="width: 65px; text-align: center;">${__('S.No.')}</th>
                                <th>${__('Purchase Order Name (Link)')}</th>
                                <th>${__('Date')}</th>
                                <th>${__('Item / Breakdown Context')}</th>
                                <th style="text-align: right;">${__('Value Balance')}</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                records.forEach((row, idx) => {
                    let po_name = row.purchase_order || row.po_number || row.name;
                    let doc_date = row.transaction_date ? frappe.datetime.str_to_user(row.transaction_date) : '-';
                    let item_desc = row.item_code || row.items || '-';
                    let metric_disp = "";

                    if (method_name === 'get_pending_items_sql') {
                        metric_disp = `${format_number(row.pending_qty, null, 2)} Qty Pending`;
                    } else if (method_name === 'get_balance_to_pay_sql') {
                        metric_disp = format_currency(row.balance_to_pay, sysCurrency);
                    } else if (method_name === 'get_po_receipt_status_sql') {
                        metric_disp = `${format_number(row.qty || row.ordered_qty || 0, null, 2)} Qty`;
                    } else if (method_name === 'get_po_invoice_status_sql') {
                        metric_disp = `${format_number(row.qty || row.ordered_qty || 0, null, 2)} Qty`;
                    } else if (method_name === 'get_purchase_orders_sql') {
                        metric_disp = format_currency(row.ordered_amount || 0, sysCurrency);
                        item_desc = `Total Ordered Qty: ${format_number(row.ordered_qty || 0, null, 2)}`;
                    } else if (method_name === 'get_po_item_status') {
                        metric_disp = `${format_number(row.received_qty || 0, null, 2)} Qty Received`;
                    } else if (method_name === 'get_invoice_payments_sql') {
                        metric_disp = format_currency(row.paid_amount || 0, sysCurrency);
                        po_name = row.parent || po_name;
                    }

                    table_html += `
                        <tr>
                            <td style="text-align: center; font-weight: 600; color: #7f8c8d;">${idx + 1}</td>
                            <td>
                                <a href="/app/purchase-order/${po_name}" target="_blank" style="font-weight:bold; color:#1abc9c; text-decoration: underline; display: inline-block;">
                                    <i class="fa fa-external-link" style="font-size: 11px; margin-right: 4px;"></i>${po_name}
                                </a>
                            </td>
                            <td>${doc_date}</td>
                            <td><span class="text-muted">${item_desc}</span></td>
                            <td style="text-align: right; font-weight:600; color:#2c3e50;">${metric_disp}</td>
                        </tr>
                    `;
                });

                table_html += `</tbody></table>`;
                d.$body.find('.drilldown-table-wrapper').html(table_html);
            }
        });
    }

    // --- KPI CARDS RENDERER WITH INTERACTIVE CLICK ROUTERS ---
    function render_all_kpi_cards(data) {
        let sysCurrency = frappe.boot.sysdefaults.currency;
        $('#kpi-container').html(`
            <div class="kpi-card" data-method="get_purchase_orders_sql" data-title="Total Purchase Orders" style="flex: 1; min-width: 140px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #2980b9; cursor: pointer; transition: transform 0.2s;">
                <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Total Count</div>
                <div style="font-size: 18px; font-weight: bold; color: #2c3e50;">${data.total_count}</div>
            </div>
            <div class="kpi-card" data-method="get_purchase_orders_sql" data-title="Total Ordered Qty" style="flex: 1; min-width: 140px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #27ae60; cursor: pointer; transition: transform 0.2s;">
                <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Total Ordered Qty</div>
                <div style="font-size: 18px; font-weight: bold; color: #2c3e50;">${format_number(data.total_qty, null, 2)}</div>
            </div>
            <div class="kpi-card" data-method="get_purchase_orders_sql" data-title="Total Grand Amount" style="flex: 1; min-width: 140px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #f39c12; cursor: pointer; transition: transform 0.2s;">
                <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Total Grand Amount</div>
                <div style="font-size: 18px; font-weight: bold; color: #2c3e50;">${format_currency(data.total_amount, sysCurrency)}</div>
            </div>
            <div class="kpi-card" data-method="get_po_item_status" data-title="Total Received Qty" style="flex: 1; min-width: 140px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #8e44ad; cursor: pointer; transition: transform 0.2s;">
                <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Total Received Qty</div>
                <div style="font-size: 18px; font-weight: bold; color: #2c3e50;">${format_number(data.total_received_qty, null, 2)}</div>
            </div>
            <div class="kpi-card" data-method="get_pending_items_sql" data-title="Pending Qty" style="flex: 1; min-width: 140px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #e74c3c; cursor: pointer; transition: transform 0.2s;">
                <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Pending Qty</div>
                <div style="font-size: 18px; font-weight: bold; color: #e74c3c;">${format_number(data.total_pending_qty, null, 2)}</div>
            </div>
            <div class="kpi-card" data-method="get_invoice_payments_sql" data-title="Paid Amount" style="flex: 1; min-width: 140px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #1abc9c; cursor: pointer; transition: transform 0.2s;">
                <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Paid Amount</div>
                <div style="font-size: 18px; font-weight: bold; color: #1abc9c;">${format_currency(data.total_paid_amount, sysCurrency)}</div>
            </div>
            <div class="kpi-card" data-method="get_balance_to_pay_sql" data-title="Balance to Pay" style="flex: 1; min-width: 140px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #d35400; cursor: pointer; transition: transform 0.2s;">
                <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Balance to Pay</div>
                <div style="font-size: 18px; font-weight: bold; color: #d35400;">${format_currency(data.total_balance_to_pay, sysCurrency)}</div>
            </div>
        `);

        // Add hovering micro-effects and attach standard global summary drilldowns
        $('.kpi-card').hover(
            function() { $(this).css('transform', 'translateY(-2px)'); },
            function() { $(this).css('transform', 'translateY(0px)'); }
        );

        $('.kpi-card').off('click').on('click', function() {
            let method = $(this).data('method');
            let title = $(this).data('title');
            open_drilldown_dialog(title, method, "All", null);
        });
    }

    function render_vertical_bar(elementId, title, categories, values, color, mode, targetMethod) {
        let chartDom = document.getElementById(elementId);
        if (!chartDom) return;
        let myChart = echarts.init(chartDom);
        let option = {
            title: { text: title, left: 'left', textStyle: { fontSize: 14, color: '#34495e' } },
            tooltip: {
                trigger: 'axis', 
                axisPointer: { type: 'shadow' },
                formatter: p => `${p[0].name}: <b>${(mode==='Val') ? format_currency(p[0].value, frappe.boot.sysdefaults.currency) : format_number(p[0].value, null, 2)}</b>`
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
        myChart.on('click', function(params) {
            if(params.name) {
                open_drilldown_dialog(title, targetMethod, params.name, params.value);
            }
        });

        window.addEventListener('resize', () => myChart.resize());
    }

    function render_donut_chart(elementId, title, data, colorPalette, targetMethod) {
        let chartDom = document.getElementById(elementId);
        if (!chartDom) return;
        let myChart = echarts.init(chartDom);
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
        myChart.on('click', function(params) {
            if(params.name) {
                open_drilldown_dialog(title, targetMethod, params.name, params.value);
            }
        });

        window.addEventListener('resize', () => myChart.resize());
    }

    function render_echart(data) {
        let chartDom = document.getElementById('procurement-funnel');
        if (!chartDom) return;
        let myChart = echarts.init(chartDom);
        let option = {
            title: { text: 'Procurement Conversion Funnel', left: 'center', top: 10 },
            tooltip: { trigger: 'item', formatter: p => `${p.name} : <b>${format_currency(p.value, frappe.boot.sysdefaults.currency)}</b>` },
            legend: { orient: 'horizontal', bottom: '0%', left: 'center', data: ['Purchase Order', 'Purchase Receipt', 'Purchase Invoice', 'Payment Entry'] },
            series: [{
                name: 'Procurement Stage', type: 'funnel', left: '25%', top: 60, bottom: 80, width: '50%',
                min: 0, minSize: '0%', maxSize: '100%', sort: 'descending', gap: 4, 
                label: { show: true, position: 'inside', formatter: p => `${p.name}\n(${format_currency(p.value, frappe.boot.sysdefaults.currency)})` },
                itemStyle: { borderColor: '#fff', borderWidth: 2 },
                data: data
            }]
        };
        myChart.setOption(option, true);
        window.addEventListener('resize', () => myChart.resize());
    }
};