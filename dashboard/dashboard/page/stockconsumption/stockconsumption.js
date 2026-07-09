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

    let allData = [];
    let filteredData = [];
    let charts = {};
    let dropdownsInitialized = false;

    // ================= UI =================
    $(page.body).html(`
        <style>
            .filters-container {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                margin-bottom: 20px;
                background: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                align-items: flex-end;
            }
            .filter-item {
                display: flex;
                flex-direction: column;
                gap: 5px;
                min-width: 180px;
                position: relative;
            }
            .filter-item label {
                font-size: 11px;
                font-weight: bold;
                color: #777;
                margin-bottom: 2px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .filter-control, .dropdown-btn {
                height: 34px;
                padding: 6px 12px;
                background: #fdfdfd;
                border: 1px solid #dcdcdc;
                border-radius: 6px;
                font-size: 12px;
                color: #333;
                outline: none;
                transition: all 0.2s ease;
                text-align: left;
                width: 100%;
                box-sizing: border-box;
            }
            .filter-control:focus, .dropdown-btn:focus {
                border-color: #2490ff;
                background: white;
                box-shadow: 0 0 0 3px rgba(36,144,255,0.15);
            }
            .dropdown-btn {
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .dropdown-btn::after {
                content: "▼";
                font-size: 8px;
                color: #888;
                margin-left: 8px;
                flex-shrink: 0;
            }
            .dropdown-content {
                display: none;
                position: absolute;
                top: 58px;
                left: 0;
                background: white;
                border: 1px solid #dcdcdc;
                border-radius: 8px;
                box-shadow: 0 8px 16px rgba(0,0,0,0.1);
                z-index: 100;
                min-width: 220px;
                max-width: 320px;
                max-height: 250px;
                overflow-y: auto;
                padding: 10px;
            }
            .dropdown-content.show {
                display: block;
            }
            .dropdown-search-wrapper {
                position: sticky;
                top: 0;
                background: white;
                padding-bottom: 6px;
                margin-bottom: 6px;
                border-bottom: 1px solid #eee;
                z-index: 2;
            }
            .dropdown-search {
                width: 100%;
                height: 28px;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 11px;
                box-sizing: border-box;
            }
            .option-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 6px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                color: #444;
                transition: background 0.15s ease;
                user-select: none;
            }
            .option-item:hover {
                background: #f1f3f5;
            }
            .option-item input[type="checkbox"] {
                margin: 0;
                cursor: pointer;
                width: 14px;
                height: 14px;
                accent-color: #2490ff;
                flex-shrink: 0;
            }
            .select-actions {
                display: flex;
                justify-content: space-between;
                padding: 2px 6px 6px 6px;
                margin-bottom: 6px;
                border-bottom: 1px solid #eee;
            }
            .select-actions a {
                font-size: 10px;
                color: #2490ff;
                text-decoration: none;
                cursor: pointer;
                font-weight: bold;
            }
            .select-actions a:hover {
                text-decoration: underline;
            }
        </style>

        <div style="padding:20px; background:#f5f7fa; min-height:100vh;">

            <h2>📊 Stock Consumption Dashboard</h2>

            <!-- FILTERS -->
            <div class="filters-container">
                <div class="filter-item">
                    <label>From Date</label>
                    <input type="date" id="from_date_input" class="filter-control">
                </div>
                <div class="filter-item">
                    <label>To Date</label>
                    <input type="date" id="to_date_input" class="filter-control">
                </div>
                <div class="filter-item" id="item_group_filter">
                    <label>Item Group</label>
                    <button class="dropdown-btn" id="item_group_btn">All Item Groups</button>
                    <div class="dropdown-content" id="item_group_content"></div>
                </div>
                <div class="filter-item" id="parent_group_filter">
                    <label>Parent Item Group</label>
                    <button class="dropdown-btn" id="parent_group_btn">All Parent Groups</button>
                    <div class="dropdown-content" id="parent_group_content"></div>
                </div>
                <div class="filter-item" id="warehouse_filter">
                    <label>Warehouse</label>
                    <button class="dropdown-btn" id="warehouse_btn">All Warehouses</button>
                    <div class="dropdown-content" id="warehouse_content"></div>
                </div>
            </div>

            <!-- CHARTS -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div id="trendChart" class="card" style="grid-column: span 2;"></div>
                <div id="itemGroupChart" class="card"></div>
                <div id="warehouseChart" class="card"></div>
                <div id="costCenterChart" class="card"></div>
                <div id="parentGroupChart" class="card"></div>
            </div>
        </div>
    `);

    $(".card").css({
        height: "400px",
        background: "#fff",
        borderRadius: "10px",
        padding: "10px"
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

function getCheckedValues(contentId) {
    let checked = [];
    $(`#${contentId} .option-item input[type="checkbox"]:checked`).each(function() {
        checked.push($(this).val());
    });
    return checked;
}

function applyFilters() {
    let fromVal = $("#from_date_input").val();
    let toVal = $("#to_date_input").val();
    
    let selectedItemGroups = getCheckedValues("item_group_content");
    let selectedParentGroups = getCheckedValues("parent_group_content");
    let selectedWarehouses = getCheckedValues("warehouse_content");

    filteredData = allData.filter(d => {
        if (fromVal && d.Date < fromVal) return false;
        if (toVal && d.Date > toVal) return false;

        let dItemGroup = d["Item Group"] || "Undefined";
        if (selectedItemGroups.length > 0 && !selectedItemGroups.includes(dItemGroup)) return false;

        let dParentGroup = d["Parent Item Group"] || "Undefined";
        if (selectedParentGroups.length > 0 && !selectedParentGroups.includes(dParentGroup)) return false;

        let dWarehouse = d["Source Warehouse"] || "Undefined";
        if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(dWarehouse)) return false;

        return true;
    });

    renderCharts(filteredData);
}

    // ================= LOAD DATA =================
    function load_data() {

        frappe.dom.freeze("Loading...");

        frappe.call({
            method: "dashboard.dashboard.page.stockconsumption.stockconsumption.get_stock_entry_report",
            args: {},
            callback: r => {
                frappe.dom.unfreeze();
                allData = r.message || [];

                if (!allData.length) {
                    frappe.msgprint("No data");
                    return;
                }

                if (!dropdownsInitialized) {
                    let itemGroups = [...new Set(allData.map(d => d["Item Group"] || "Undefined"))].sort();
                    let parentGroups = [...new Set(allData.map(d => d["Parent Item Group"] || "Undefined"))].sort();
                    let warehouses = [...new Set(allData.map(d => d["Source Warehouse"] || "Undefined"))].sort();

                    initCheckboxDropdown("item_group_btn", "item_group_content", itemGroups, "Item Group");
                    initCheckboxDropdown("parent_group_btn", "parent_group_content", parentGroups, "Parent Group");
                    initCheckboxDropdown("warehouse_btn", "warehouse_content", warehouses, "Warehouse");

                    dropdownsInitialized = true;
                }

                applyFilters();
            }
        });
    }

    // ================= CUSTOM DROPDOWN FILTER UI =================
    function initCheckboxDropdown(btnId, contentId, uniqueValues, placeholder) {
        let $btn = $(`#${btnId}`);
        let $content = $(`#${contentId}`);

        // Toggle dropdown
        $btn.on("click", function(e) {
            e.stopPropagation();
            $(".dropdown-content").not($content).removeClass("show");
            $content.toggleClass("show");
        });

        // Prevent click inside from closing dropdown
        $content.on("click", function(e) {
            e.stopPropagation();
        });

        // Build HTML content
        let html = `
            <div class="dropdown-search-wrapper">
                <input type="text" class="dropdown-search" placeholder="Search ${placeholder}...">
            </div>
            <div class="select-actions">
                <a class="select-all">Select All</a>
                <a class="select-none">Clear</a>
            </div>
            <div class="options-container" style="max-height: 180px; overflow-y: auto;">
        `;

        uniqueValues.forEach(val => {
            let cleanVal = val || "Undefined";
            let chkId = `chk_${contentId}_${cleanVal.replace(/[^a-zA-Z0-9]/g, '_')}`;
            html += `
                <div class="option-item">
                    <input type="checkbox" value="${cleanVal}" id="${chkId}">
                    <label style="margin:0; font-weight:normal; cursor:pointer; width:100%;" for="${chkId}">${cleanVal}</label>
                </div>
            `;
        });

        html += `</div>`;
        $content.html(html);

        let $optionsContainer = $content.find(".options-container");

        // Search options
        $content.find(".dropdown-search").on("input", function() {
            let q = $(this).val().toLowerCase();
            $optionsContainer.find(".option-item").each(function() {
                let text = $(this).find("label").text().toLowerCase();
                if (text.indexOf(q) > -1) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });

        // Select All
        $content.find(".select-all").on("click", function() {
            $optionsContainer.find(".option-item input[type='checkbox']").prop("checked", true);
            updateButtonText();
            applyFilters();
        });

        // Clear
        $content.find(".select-none").on("click", function() {
            $optionsContainer.find(".option-item input[type='checkbox']").prop("checked", false);
            updateButtonText();
            applyFilters();
        });

        // Checkbox change
        $optionsContainer.on("change", "input[type='checkbox']", function() {
            updateButtonText();
            applyFilters();
        });

        function updateButtonText() {
            let checkedCount = $optionsContainer.find("input[type='checkbox']:checked").length;

            if (checkedCount === 0) {
                $btn.text(`All ${placeholder}s`);
            } else if (checkedCount === uniqueValues.length) {
                $btn.text(`All ${placeholder}s`);
            } else {
                $btn.text(`${checkedCount} Selected`);
            }
        }
    }

    // Close dropdowns on document click
    $(document).on("click", function() {
        $(".dropdown-content").removeClass("show");
    });

    // Bind date change events
    $("#from_date_input, #to_date_input").on("change", function() {
        applyFilters();
    });

    // ================= RENDER CHARTS =================
    function renderCharts(data) {

    Object.values(charts).forEach(c => c.dispose());
    charts = {};

    // ================= TREND =================
    let trendMap = {};
    data.forEach(d=>{
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
        showDrillDown(p.name,data.filter(d=>getMonthKey(d.Date)===p.name));
    });

    // ================= ITEM GROUP =================
    let grp = groupBy(data,"Item Group");
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
        showDrillDown(p.name,data.filter(d=>d["Item Group"]===p.name));
    });

    // ================= WAREHOUSE =================
    let wh = groupBy(data,"Source Warehouse");
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
        showDrillDown(p.name,data.filter(d=>d["Source Warehouse"]===p.name));
    });

    // ================= COST CENTER =================
    let cc = groupBy(data,"Cost Center");
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
        showDrillDown(p.name,data.filter(d=>d["Cost Center"]===p.name));
    });

    // ================= ParentItem Bar chart =================
    let pg = groupBy(data,"Parent Item Group");
    let pgkeys = Object.keys(pg);

    charts.parentGroup = echarts.init(document.getElementById("parentGroupChart"));
    charts.parentGroup.setOption({
        title:{text:"Parent Item Group"},
        tooltip:{trigger:"axis"},
        legend:{data:["Amount","Qty"]},
        xAxis:{type:"category",data:pgkeys},
        yAxis:{type:"value"},
        series:[
            {name:"Amount",type:"bar",data:pgkeys.map(k=>pg[k].amount)},
            {name:"Qty",type:"bar",data:pgkeys.map(k=>pg[k].qty)}
        ]
    });

    charts.parentGroup.on('click',p=>{
        showDrillDown(p.name,data.filter(d=>d["Parent Item Group"]===p.name));
    });

    // resize fix
    window.onresize = () => Object.values(charts).forEach(c => c.resize());
}

// initial load
load_data();
}