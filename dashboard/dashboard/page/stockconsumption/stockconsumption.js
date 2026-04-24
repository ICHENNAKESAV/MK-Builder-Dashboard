frappe.pages['stockconsumption'].on_page_load = function(wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        single_column: true
    });

    $(wrapper).css('padding', '0px');
    $(wrapper).find('.page-head').hide();
    $(page.body).parent().css('padding', '0px');

    $('.navbar').hide();
    $('.navbar .container').hide();

    let currentData = [];
    let charts = {};
    let filters = {};

    // ================= UI =================
    $(page.body).html(`
        <div style="padding:20px; background:#f5f7fa; min-height:100vh;">

            <h2>📊 Stock Consumption Dashboard</h2>

            <!-- FILTERS -->
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; background:white; padding:15px; border-radius:10px;">

                <div id="from_date"></div>
                <div id="to_date"></div>
                <div id="item_group"></div>
                <div id="parent_group"></div>
                <div id="warehouse"></div>

                <button class="btn btn-primary" id="applyFilters">Apply</button>
                <button class="btn btn-default" id="resetFilters">Reset</button>
            </div>

            <!-- CHARTS -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div id="trendChart" class="card"></div>
                <div id="topItemsChart" class="card"></div>
                <div id="itemGroupChart" class="card"></div>
                <div id="warehouseChart" class="card"></div>
                <div id="costCenterChart" class="card"></div>
                <div id="itemPieChart" class="card"></div>
            </div>
        </div>
    `);

    $(".card").css({
        height: "400px",
        background: "#fff",
        borderRadius: "10px",
        padding: "10px"
    });

    // ================= FILTER CONTROLS =================
    let from_date = frappe.ui.form.make_control({
        parent: $("#from_date"),
        df: { fieldtype: "Date", label: "From Date" },
        render_input: true
    });

    let to_date = frappe.ui.form.make_control({
        parent: $("#to_date"),
        df: { fieldtype: "Date", label: "To Date" },
        render_input: true
    });

    let item_group = frappe.ui.form.make_control({
        parent: $("#item_group"),
        df: { fieldtype: "Link", options: "Item Group", label: "Item Group" },
        render_input: true
    });

    let parent_group = frappe.ui.form.make_control({
    parent: $("#parent_group"),
    df: {
        fieldtype: "Select",
        label: "Parent Group",
        options: [
            "Select Parent Group",
            "All Item Groups",
            "ASSET",
            "Civil",
            "DOORS AND WINDOW FIXTURES",
            "Electrical",
            "Hardware",
            "MACHINEARY SPARES",
            "Paints",
            "PLUMBING AND WATER SUPPLY",
            "RMC RAW MATERIALS",
            "SAFETY",
            "STEEL",
            "Tiles",
            "Welding And Fabrication",
            "WOODEN RUNNERS AND PLY WOOD"
        ].join("\n")
    },
    render_input: true
    });

    let warehouse = frappe.ui.form.make_control({
        parent: $("#warehouse"),
        df: { fieldtype: "Link", options: "Warehouse", label: "Warehouse" },
        render_input: true
    });

    // ================= HELPERS =================
    function groupBy(data, key) {
        let map = {};

        data.forEach(d => {
            let k = d[key] || "Undefined";

            if (!map[k]) {
                map[k] = { amount: 0, qty: 0 };
            }

            map[k].amount = flt(map[k].amount + flt(d["Total Amount"]), 2);
            map[k].qty = flt(map[k].qty + flt(d["Total Quantity"]), 2);
        });

        return map;
    }

    function getMonthKey(dateStr) {
        let parts = dateStr.split("-");
        let d = new Date(parts[0], parts[1] - 1, parts[2]);

        let m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${m[d.getMonth()]} ${d.getFullYear()}`;
    }

    function sortMonths(keys) {
        const order = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

        return keys.sort((a,b)=>{
            let [ma,ya] = a.split(" ");
            let [mb,yb] = b.split(" ");
            return ya !== yb ? ya - yb : order[ma] - order[mb];
        });
    }

    function showDrillDown(title, rows) {

    let d = new frappe.ui.Dialog({
        title: title,
        size: "extra-large",
        fields: [{ fieldtype: "HTML", fieldname: "tbl" }]
    });

    let html = `
    <style>
        .drill-table {
            font-size: 11px;
            margin-bottom: 0;
        }

        .drill-table th,
        .drill-table td {
            padding: 4px 6px !important;
            line-height: 1.2 !important;
            vertical-align: middle;
        }

        .drill-table thead th {
            position: sticky;
            top: 0;
            background: #f8f9fa;
            z-index: 1;
        }

        .truncate {
            max-width: 140px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .num {
            text-align: right;
        }
    </style>

    <div style="max-height:65vh; overflow:auto; border:1px solid #ddd;">
        <table class="table table-bordered table-sm drill-table">
            <thead>
                <tr>
                    <th style="width:50px;">SINO</th>
                    <th style="width:90px;">Date</th>
                    <th class="truncate">Item Group</th>
                    <th class="truncate">Parent Group</th>
                    <th class="truncate">Item</th>
                    <th class="truncate">Cost Center</th>
                    <th class="truncate">Warehouse</th>
                    <th style="width:90px;" class="num">Qty</th>
                    <th style="width:110px;" class="num">Amount</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach((r, i) => {
        html += `
        <tr>
            <td>${i + 1}</td>
            <td>${r.Date || "-"}</td>
            <td class="truncate" title="${r["Item Group"] || ""}">${r["Item Group"] || "-"}</td>
            <td class="truncate" title="${r["Parent Item Group"] || ""}">${r["Parent Item Group"] || "-"}</td>
            <td class="truncate" title="${r.Item || ""}">${r.Item || "-"}</td>
            <td class="truncate" title="${r["Cost Center"] || ""}">${r["Cost Center"] || "-"}</td>
            <td class="truncate" title="${r["Source Warehouse"] || ""}">${r["Source Warehouse"] || "-"}</td>
            <td class="num">${flt(r["Total Quantity"], 2)}</td>
            <td class="num">${flt(r["Total Amount"], 2)}</td>
        </tr>`;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    d.fields_dict.tbl.$wrapper.html(html);

    // Reduce dialog padding
    d.$wrapper.find('.modal-body').css({
        padding: '8px'
    });

    d.show();
}

    // ================= LOAD DATA =================
    function load_data() {

        frappe.dom.freeze("Loading...");

        frappe.call({
            method: "dashboard.dashboard.page.stockconsumption.stockconsumption.get_stock_entry_report",
            args: filters,
            callback: r => {
                frappe.dom.unfreeze();
                currentData = r.message || [];

                if (!currentData.length) {
                    frappe.msgprint("No data");
                    return;
                }

                renderCharts();
            }
        });
    }

    // ================= RENDER CHARTS =================
    function renderCharts() {

    Object.values(charts).forEach(c => c.dispose());
    charts = {};

    // ================= TREND =================
    let trendMap = {};
    currentData.forEach(d=>{
        let m = getMonthKey(d.Date);
        trendMap[m] = flt((trendMap[m] || 0) + flt(d["Total Amount"]), 2);
    });

    let months = sortMonths(Object.keys(trendMap));

    charts.trend = echarts.init(document.getElementById("trendChart"));
    charts.trend.setOption({
        title:{text:"Monthly Trend"},
        tooltip:{trigger:"axis"},
        xAxis:{type:"category",data:months},
        yAxis:{type:"value"},
        series:[{type:"line",smooth:true,data:months.map(m=>trendMap[m])}]
    });

    charts.trend.on('click',p=>{
        showDrillDown(p.name,currentData.filter(d=>getMonthKey(d.Date)===p.name));
    });

    // ================= TOP ITEMS =================
    let itemMap = {};
    currentData.forEach(d=>{
        let k = d.Item || "Undefined";
        itemMap[k] = flt((itemMap[k] || 0) + flt(d["Total Amount"]), 2);
    });

    let top = Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,10);

    charts.top = echarts.init(document.getElementById("topItemsChart"));
    charts.top.setOption({
        title:{text:"Top Items"},
        tooltip:{trigger:"axis"},
        xAxis:{type:"category",data:top.map(i=>i[0])},
        yAxis:{},
        series:[{type:"bar",data:top.map(i=>i[1])}]
    });

    charts.top.on('click',p=>{
        showDrillDown(p.name,currentData.filter(d=>d.Item===p.name));
    });

    // ================= ITEM GROUP =================
    let grp = groupBy(currentData,"Item Group");
    let gkeys = Object.keys(grp);

    charts.group = echarts.init(document.getElementById("itemGroupChart"));
    charts.group.setOption({
        title:{text:"Item Group"},
        tooltip:{trigger:"axis"},
        legend:{data:["Amount","Qty"]},
        xAxis:{type:"category",data:gkeys},
        yAxis:{type:"value"},
        series:[
            {name:"Amount",type:"bar",data:gkeys.map(k=>grp[k].amount)},
            {name:"Qty",type:"bar",data:gkeys.map(k=>grp[k].qty)}
        ]
    });

    charts.group.on('click',p=>{
        showDrillDown(p.name,currentData.filter(d=>d["Item Group"]===p.name));
    });

    // ================= WAREHOUSE =================
    let wh = groupBy(currentData,"Source Warehouse");
    let wkeys = Object.keys(wh);

    charts.wh = echarts.init(document.getElementById("warehouseChart"));
    charts.wh.setOption({
        title:{text:"Warehouse"},
        tooltip:{trigger:"axis"},
        legend:{data:["Amount","Qty"]},
        yAxis:{type:"category",data:wkeys},
        xAxis:{type:"value"},
        series:[
            {name:"Amount",type:"bar",data:wkeys.map(k=>wh[k].amount)},
            {name:"Qty",type:"bar",data:wkeys.map(k=>wh[k].qty)}
        ]
    });

    charts.wh.on('click',p=>{
        showDrillDown(p.name,currentData.filter(d=>d["Source Warehouse"]===p.name));
    });

    // ================= COST CENTER =================
    let cc = groupBy(currentData,"Cost Center");
    let ckeys = Object.keys(cc);

    charts.cc = echarts.init(document.getElementById("costCenterChart"));
    charts.cc.setOption({
        title:{text:"Cost Center"},
        tooltip:{trigger:"axis"},
        legend:{data:["Amount","Qty"]},
        xAxis:{type:"category",data:ckeys},
        yAxis:{type:"value"},
        series:[
            {name:"Amount",type:"bar",data:ckeys.map(k=>cc[k].amount)},
            {name:"Qty",type:"bar",data:ckeys.map(k=>cc[k].qty)}
        ]
    });

    charts.cc.on('click',p=>{
        showDrillDown(p.name,currentData.filter(d=>d["Cost Center"]===p.name));
    });

    // ================= PIE =================
    charts.pie = echarts.init(document.getElementById("itemPieChart"));

    let pieData = Object.entries(itemMap).map(([n, v]) => ({
        name: n,
        value: flt(v, 2)
    }));

    charts.pie.setOption({
        title: { text: "Item Share", left: "center" },
        tooltip: {
            trigger: "item",
            formatter: p => `${p.name}: ${flt(p.value, 2)} (${p.percent}%)`
        },
        series: [{
            type: "pie",
            radius: "60%",
            center: ["40%", "50%"],
            data: pieData,
            label: {
                show: false
            }
        }]
    });

    charts.pie.on('click', p => {
        showDrillDown(p.name, currentData.filter(d => (d.Item || "Undefined") === p.name));
    });

    // resize fix
    window.onresize = () => Object.values(charts).forEach(c => c.resize());
}
// ================= FILTER EVENTS =================
$("#applyFilters").click(() => {
    filters = {
        from_date: from_date.get_value(),
        to_date: to_date.get_value(),
        item_group: item_group.get_value(),
        parent_item_group: parent_group.get_value(),
        warehouse: warehouse.get_value()
    };
    load_data();
});

$("#resetFilters").click(() => {
    filters = {};
    load_data();
});

// initial load
load_data();
}