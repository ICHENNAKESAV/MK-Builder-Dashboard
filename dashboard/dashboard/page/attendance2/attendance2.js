frappe.pages['attendance2'].on_page_load = function (wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Attendance Dashboard (KPI + Drilldown)',
        single_column: true
    });

    $(wrapper).css('padding', '0px');
    $(wrapper).find('.page-head').hide();
    $(page.body).parent().css('padding', '0px');
    $('.navbar').hide();

    let $container = $(`
    <div class="attendance-dashboard">

        <!-- TITLE -->
        <div class="row" style="margin:0;padding:15px 20px;background:#fff;border-bottom:1px solid #eee;">
            <div class="col-md-6">
                <h3 style="margin:0;font-weight:600;">Attendance Dashboard</h3>
                <small style="color:#888;">KPI + Drilldown Analytics</small>
            </div>
        </div>

        <!-- FILTERS (BELOW TITLE) -->
        <div class="row filters" style="
            margin:0;
            padding:15px 20px;
            background:#fafafa;
            border-bottom:1px solid #eee;
            display:flex;
            gap:15px;
        "></div>

        <!-- KPI -->
        <div class="row kpi-section" style="margin:20px 0;"></div>

        <!-- CHARTS -->
        <div class="row">

            <div class="col-md-6">
                <div class="card shadow-sm p-3">
                    <div id="pie_chart" style="height:350px;"></div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card shadow-sm p-3">
                    <div id="branch_chart" style="height:350px;"></div>
                </div>
            </div>

        </div>

    </div>
    `).appendTo(page.body);

    let original_data = [];
    let filtered_data = [];
    let branch_map = {};

    // ---------------- FILTERS ----------------
    let date_field = page.add_field({
        label: "Date",
        fieldtype: "Date",
        change: load_data
    });

    let department_field = page.add_field({
        label: "Department",
        fieldtype: "Link",
        options: "Department",
        change: load_data
    });

    let branch_field = page.add_field({
        label: "Branch",
        fieldtype: "Link",
        options: "Branch",
        change: load_data
    });

    date_field.set_value(frappe.datetime.get_today());

    // FIX: MOVE FILTERS INTO YOUR UI
    setTimeout(() => {
        $container.find(".filters").append(
            date_field.$wrapper
        );
        $container.find(".filters").append(
            department_field.$wrapper
        );
        $container.find(".filters").append(
            branch_field.$wrapper
        );
    }, 200);

    // ---------------- LOAD DATA ----------------
    function load_data() {
        frappe.call({
            method: "dashboard.dashboard.page.attendance2.attendance2.get_employee_attendance",
            args: {
                date: date_field.get_value(),
                department: department_field.get_value() || "All Departments",
                branch: branch_field.get_value() || "All Branches"
            },
            callback: function (r) {
                if (r.message) {
                    original_data = r.message;
                    apply_filters_and_render();
                }
            }
        });
    }

    // ---------------- FILTER LOGIC ----------------
    function apply_filters_and_render() {

        let dept = department_field.get_value();
        let branch = branch_field.get_value();

        filtered_data = original_data.filter(d => {

            let okDept = !dept || dept === "All Departments" || d.department === dept;
            let okBranch = !branch || branch === "All Branches" || d.branch === branch;

            return okDept && okBranch;
        });

        build_branch_map();
        render_kpis(filtered_data);
        render_pie(filtered_data);
        render_branch_bar(filtered_data);
    }

    function norm(v) {
        return (v || "").toString().trim().toLowerCase();
    }

    function build_branch_map() {
        branch_map = {};
        filtered_data.forEach(d => {
            let key = norm(d.branch || "No Branch");
            branch_map[key] = branch_map[key] || [];
            branch_map[key].push(d);
        });
    }

    // ---------------- KPI ----------------
    function render_kpis(data) {

        let present = data.filter(d => d.Status === "Present").length;
        let absent = data.filter(d => d.Status === "Absent").length;
        let holiday = data.filter(d => d.Status === "Holiday").length;
        let total = data.length;

        let kpis = [
            { label: "Total", value: total, color: "#007bff" },
            { label: "Present", value: present, color: "#28a745" },
            { label: "Absent", value: absent, color: "#dc3545" },
            { label: "Holiday", value: holiday, color: "#ffc107" }
        ];

        let html = kpis.map(k => `
            <div class="col-md-3">
                <div class="card shadow-sm kpi-card"
                    style="border-left:5px solid ${k.color};cursor:pointer;">
                    <div class="card-body text-center">
                        <h6>${k.label}</h6>
                        <h3 style="color:${k.color}">${k.value}</h3>
                    </div>
                </div>
            </div>
        `).join("");

        $container.find(".kpi-section").html(html);

        $(".kpi-card").off("click").on("click", function () {

            let type = $(this).find("h6").text();

            let filtered = (type === "Total")
                ? data
                : data.filter(d => d.Status === type);

            render_modal_table(filtered, type);
        });
    }

    // ---------------- PIE ----------------
    function render_pie(data) {

        let dom = document.getElementById("pie_chart");

        let chart = echarts.getInstanceByDom(dom);
        if (chart) chart.dispose();

        chart = echarts.init(dom);

        let present = data.filter(d => d.Status === "Present").length;
        let absent = data.filter(d => d.Status === "Absent").length;
        let holiday = data.filter(d => d.Status === "Holiday").length;
        let weekoff = data.filter(d => d.Status === "Week Off").length;

        chart.setOption({
            title: { text: "Attendance Status", left: "center" },
            tooltip: {
                trigger: "item",
                formatter: "{b}<br/>Count: {c}<br/>Percent: {d}%"
            },
            legend: { bottom: 0 },
            series: [{
                type: "pie",
                radius: "65%",
                data: [
                    { value: present, name: "Present" },
                    { value: absent, name: "Absent" },
                    { value: holiday, name: "Holiday" },
                    { value: weekoff, name: "Week Off" }
                ]
            }]
        });

        chart.off("click");
        chart.on("click", p => {
            render_modal_table(data.filter(d => d.Status === p.name), p.name);
        });
    }

    // ---------------- BAR ----------------
    function render_branch_bar(data) {

        let grouped = {};

        data.forEach(d => {
            let key = d.branch || "No Branch";

            if (!grouped[key]) {
                grouped[key] = { present: 0, total: 0 };
            }

            grouped[key].total++;

            if (d.Status === "Present") {
                grouped[key].present++;
            }
        });

        let branches = Object.keys(grouped);
        let present = branches.map(b => grouped[b].present);
        let total = branches.map(b => grouped[b].total);

        let dom = document.getElementById("branch_chart");

        let chart = echarts.getInstanceByDom(dom);
        if (chart) chart.dispose();

        chart = echarts.init(dom);

        chart.setOption({
            title: { text: "Branch-wise Attendance", left: "center" },
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            legend: { bottom: 0 },
            xAxis: { type: "category", data: branches },
            yAxis: { type: "value" },
            series: [
                { name: "Present", type: "bar", data: present, itemStyle: { color: "#28a745" } },
                { name: "Total", type: "bar", data: total, itemStyle: { color: "#007bff" } }
            ]
        });

        chart.off("click");

        chart.on("click", function (p) {
            let key = norm(p.name);
            let filtered = branch_map[key] || [];
            render_modal_table(filtered, "Branch: " + p.name);
        });
    }

    // ---------------- MODAL ----------------
    function render_modal_table(data, title) {

        let rows = data.map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${d.Date || ""}</td>
                <td>${d["Emp ID"] || ""}</td>
                <td>${d.Employee || ""}</td>
                <td>${d.branch || ""}</td>
                <td>${d["Check In"] || ""}</td>
                <td>${d["Check Out"] || ""}</td>
                <td>${d["Worked Hours"] || ""}</td>
                <td>${d.OT || ""}</td>
                <td>${d.Status || ""}</td>
            </tr>
        `).join("");

        let dialog = new frappe.ui.Dialog({
            title: title,
            size: "extra-large",
            fields: [{
                fieldtype: "HTML",
                fieldname: "table_html"
            }]
        });

        dialog.show();

        dialog.fields_dict.table_html.$wrapper.html(`
            <div style="max-height:500px;overflow:auto;">
                <table class="table table-bordered table-hover table-striped">

                    <thead class="table-dark">
                        <tr>
                            <th>Sl No</th>
                            <th>Date</th>
                            <th>Emp ID</th>
                            <th>Employee</th>
                            <th>Branch</th>
                            <th>Check In</th>
                            <th>Check Out</th>
                            <th>Worked Hours</th>
                            <th>OT</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>${rows}</tbody>

                </table>
            </div>
        `);
    }

    load_data();
};