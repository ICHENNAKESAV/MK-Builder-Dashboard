frappe.pages['procurement2'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Procurement Dashboard',
        single_column: true
    });

    // 1. Structural Grid Containers with Fixed Dimensions
    let $body = $(wrapper).find('.layout-main-section');
    $body.append(`
        <div class="row" style="margin: 15px -15px 0 -15px; display: flex; flex-wrap: wrap;">
            <div class="col-md-6" style="margin-bottom: 20px;">
                <div class="card" style="padding: 20px; border: 1px solid #d1d8dd; border-radius: 4px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); min-height: 460px;">
                    <h5 style="margin-bottom: 15px; font-weight: 600;">Material Issue Summary (By Cost Center)</h5>
                    <div id="material-issue-chart" style="width: 100%; height: 380px;"></div>
                </div>
            </div>
            <div class="col-md-6" style="margin-bottom: 20px;">
                <div class="card" style="padding: 20px; border: 1px solid #d1d8dd; border-radius: 4px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); min-height: 460px;">
                    <h5 style="margin-bottom: 15px; font-weight: 600;">Purchase Receipt Summary</h5>
                    <div id="purchase-receipt-chart" style="width: 100%; height: 380px;"></div>
                </div>
            </div>
        </div>
    `);

    // 2. Initialize ECharts Elements
    let materialChart = echarts.init(document.getElementById('material-issue-chart'));
    let purchaseChart = echarts.init(document.getElementById('purchase-receipt-chart'));

    window.addEventListener('resize', function() {
        materialChart.resize();
        purchaseChart.resize();
    });

    // 3. Setup Interactive Filters
    let company_field = page.add_field({
        fieldname: 'company', label: __('Company'), fieldtype: 'Link', options: 'Company',
        change: () => trigger_refresh()
    });

    let from_date_field = page.add_field({
        fieldname: 'from_date', label: __('From Date'), fieldtype: 'Date',
        change: () => trigger_refresh()
    });

    let to_date_field = page.add_field({
        fieldname: 'to_date', label: __('To Date'), fieldtype: 'Date',
        change: () => trigger_refresh()
    });

    let item_group_field = page.add_field({
        fieldname: 'item_group', label: __('Item Group'), fieldtype: 'Link', options: 'Item Group',
        change: () => trigger_refresh()
    });

    // NEW FILTER: Only for the 2nd Chart Period interval grouping
    let period_field = page.add_field({
        fieldname: 'group_by_period', 
        label: __('Period (Chart 2)'), 
        fieldtype: 'Select', 
        options: ['Weekly', 'Monthly', 'Quarterly', 'Yearly'],
        default: 'Monthly',
        change: () => trigger_refresh()
    });

    // 4. Centralized Controller Data Fetching
    function trigger_refresh() {
        let filters = {
            company: company_field.get_value(),
            from_date: from_date_field.get_value(),
            to_date: to_date_field.get_value(),
            item_group: item_group_field.get_value()
        };

        // Extract value for the period filter
        let period_filter = period_field.get_value() || 'Monthly';

        // Pull and update Chart 1
        frappe.call({
            method: 'dashboard.dashboard.page.procurement2.procurement2.get_material_issue_summary',
            args: filters,
            callback: function(r) {
                render_material_chart(r.message || []);
            }
        });

        // Pull and update Chart 2 (Passes the extra period parameter)
        frappe.call({
            method: 'dashboard.dashboard.page.procurement2.procurement2.get_purchase_receipt_summary',
            args: { ...filters, group_by_period: period_filter },
            callback: function(r) {
                render_purchase_chart(r.message || [], period_filter);
            }
        });
    }

    // 5. Chart 1: Cost Center Rendering
    function render_material_chart(data) {
        let categories = data.map(d => d.cost_center);
        let values = data.map(d => d.amount);

        let option = {
            tooltip: { trigger: 'axis' },
            grid: { top: '10%', left: '4%', right: '4%', bottom: '18%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { 
                    rotate: 0,
                    interval: 0, 
                    overflow: 'break',
                    hideOverlap: true
                }
            },
            yAxis: { type: 'value' },
            series: [{
                data: values,
                type: 'bar',
                itemStyle: { color: '#5470c6' }
            }]
        };
        materialChart.setOption(option, true);
        materialChart.resize();
    }

    // 6. Chart 2: Dynamic Period Rendering
    function render_purchase_chart(data, period_label) {
        // Maps the transformed native DB string (e.g., '2026-W24', '2026-Q2') onto the X-Axis
        let categories = data.map(d => d.period);
        let values = data.map(d => d.Total_purchase_amount);

        let option = {
            title: {
                text: `Grouped: ${period_label}`,
                textStyle: { fontSize: 12, color: '#888', fontWeight: 'normal' },
                right: '4%',
                top: '0%'
            },
            tooltip: { trigger: 'axis' },
            grid: { top: '12%', left: '4%', right: '4%', bottom: '18%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { 
                    rotate: 0,
                    interval: 'auto'
                }
            },
            yAxis: { type: 'value' },
            series: [{
                data: values,
                type: 'bar',
                itemStyle: { color: '#91cc75' }
            }]
        };
        purchaseChart.setOption(option, true);
        purchaseChart.resize();
    }

    // Delay initial pull slightly so Frappe finishes building DOM dimensions.
    setTimeout(() => {
        trigger_refresh();
    }, 250);
};