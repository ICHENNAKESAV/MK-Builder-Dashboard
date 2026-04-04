frappe.pages['hr3'].on_page_load = function(wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        single_column: true
    });

	$(wrapper).css('padding', '0px');
    
    // 2. Hide the default Frappe Page Head (where the title usually sits)
    $(wrapper).find('.page-head').hide();
    
    // 3. Ensure the body fills the available height
    $(page.body).parent().css('padding', '0px');

    // -------------------------------
    // SIDEBAR
    // -------------------------------
    function renderSidebar(){
        return `
        <div style="padding:30px; margin-top:30px;">

            <div onclick="navigateTo('hr3')" style="padding:10px; cursor:pointer;">
                HR Dashboard
            </div>

            <div onclick="navigateTo('crm2')" style="padding:10px; cursor:pointer;">
                CRM Dashboard
            </div>
        </div>
        `;
    }

    // -------------------------------
    // LAYOUT
    // -------------------------------
    $(page.body).html(`
        <div style="display:flex; height:100vh; overflow:hidden;">

            <!-- SIDEBAR -->
            <div id="app-sidebar"></div>
			<div id="overlay"></div>

            <!-- RIGHT SIDE -->
            <div style="flex:1; display:flex; flex-direction:column;">

                <!-- HEADER -->
                <div style="
                    height:50px;
                    background:#fff;
                    display:flex;
                    align-items:center;
                    padding:0 15px;
                    box-shadow:0 2px 5px rgba(0,0,0,0.1);
                    z-index:10;
                    flex-shrink:0;
                ">
                    <button id="menu-toggle" style="
                        margin-right:10px;
                        font-size:18px;
                        cursor:pointer;
                    ">☰</button>

                    <h3 style="margin:0; font-size:18px;">HR Dashboard</h3>
                </div>

                <!-- MAIN CONTENT -->
                <div id="app-content" style="
                    flex:1;
                    overflow:auto;
                    background:#f4f6f9;
                    padding:15px;
                ">

                    <!-- FILTERS -->
                    <div style="display:flex; flex-wrap: wrap; gap:15px; margin-bottom:20px;">
                        ${filterDropdown('filter_dept', 'Filter Department')}
                        ${filterDropdown('filter_desig', 'Filter Designation')}
                        ${filterDropdown('filter_branch', 'Filter Branch')}
                        <button id="clear_filters" style="
                            background:#e74a3b; color:#fff; border:none;margin-top:15px;
                            padding:6px 10px; border-radius:4px;
                            cursor:pointer; font-weight:bold;
                        ">Clear</button>
                    </div>

                    <!-- KPI -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:15px; margin-bottom:20px;">
                        ${kpi("Total Employees","total_emp","#4e73df")}
                        ${kpi("Departments","total_dept","#1cc88a")}
                        ${kpi("Designations","total_desig","#36b9cc")}
                        ${kpi("Branches","total_branch","#f6c23e")}
                    </div>

                    <!-- CHARTS -->
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:20px;">
                        ${chartCard("dept_chart")}
                        ${chartCard("branch_chart")}
                        ${chartCard("emp_type_chart")}
                        ${chartCard("gender_chart")}
                    </div>

                    <!-- FULL WIDTH -->
                    <div style="margin-top:20px;">
                        ${chartCard("desig_chart", true)}
                    </div>

                </div>
            </div>
        </div>

        <style>
			/* SIDEBAR */
			#app-sidebar{
				position:fixed;
				left:-240px;
				top:0;
				width:240px;
				height:100%;
				z-index:999;
				background:#2d3748;
				color:#fff;
				transition:0.3s;
			}

			/* OPEN */
			#app-sidebar.active{
				left:0;
			}

			/* OVERLAY */
			#overlay{
				position:fixed;
				top:0;
				left:0;
				width:100%;
				height:100%;
				background:rgba(0,0,0,0.4);
				z-index:998;
				display:none;
			}

			/* SHOW OVERLAY */
			#overlay.active{
				display:block;
			}
			</style>
    `);

    // -------------------------------
    // LOAD SIDEBAR
    // -------------------------------
    $('#app-sidebar').html(renderSidebar());

    // -------------------------------
    // TOGGLE
    // -------------------------------
	$(document).off('click','#menu-toggle').on('click','#menu-toggle', function(e){
    	e.stopPropagation();

		$('#app-sidebar').toggleClass('active');
		$('#overlay').toggleClass('active');
	});

		// CLICK OUTSIDE (overlay)
		$(document).off('click','#overlay').on('click','#overlay', function(){
			$('#app-sidebar').removeClass('active');
			$('#overlay').removeClass('active');
		});

    // -------------------------------
    // NAVIGATION FUNCTION
    // -------------------------------
    window.navigateTo = function(route){
        frappe.set_route(route);
		setTimeout(()=> location.reload(), 100);
    };


	// -------------------------------
	function filterDropdown(id, label){
		return `
		<div style="flex: 1 1 220px; min-width: 220px;">
			<label for="${id}" style="font-weight:600; display:block; margin-bottom:6px; color:#444;">${label}</label>
			<select id="${id}" style="
				width: 100%;
				padding: 8px 12px;
				border-radius: 6px;
				border: 1.5px solid #ccc;
				font-size: 14px;
				transition: border-color 0.3s;
			">
				<option value="">All</option>
			</select>
		</div>`;
	}

	function kpi(title,id,color){
		return `
		<div style="
			background:#fff;
			border-radius:10px;
			padding:15px;
			box-shadow:0 2px 8px rgba(0,0,0,0.08);
			border-left:5px solid ${color};
		">
			<div style="font-size:13px; color:#666;">${title}</div>
			<div style="font-size:28px; font-weight:bold; color:${color};" id="${id}">0</div>
		</div>`;
	}

	function chartCard(id, full=false){
		return `
		<div style="
			background:#fff;
			border-radius:10px;
			padding:15px;
			box-shadow:0 2px 8px rgba(0,0,0,0.08);
			height:${full ? '450px' : '400px'};
		">
			<div id="${id}" style="width:100%; height:100%;"></div>
		</div>`;
	}

	// -------------------------------
	let allEmployees = [];
	let filteredEmployees = [];
	let charts = {};

	function initChart(id){
		if(charts[id]) charts[id].dispose();
		charts[id] = echarts.init(document.getElementById(id));
		return charts[id];
	}

	// -------------------------------
	// API
	// -------------------------------
	frappe.call({
		method: "dashboard.dashboard.page.hr3.hr3.get_employee_list",
		callback: function(r) {
			if(r.message){
				allEmployees = r.message;
				filteredEmployees = allEmployees.slice();
				populateFilters();
				updateDashboard();
			}
		}
	});

	// -------------------------------
	// Populate filter dropdown options dynamically
	function populateFilters(){
		populateDropdown('filter_dept', [...new Set(allEmployees.map(e=>e.department).filter(Boolean))].sort());
		populateDropdown('filter_desig', [...new Set(allEmployees.map(e=>e.designation).filter(Boolean))].sort());
		populateDropdown('filter_branch', [...new Set(allEmployees.map(e=>e.branch).filter(Boolean))].sort());
	}

	function populateDropdown(id, options){
		let select = $(`#${id}`);
		options.forEach(opt => {
			select.append(`<option value="${opt}">${opt}</option>`);
		});
	}

	// -------------------------------
	// Event listeners for filters
	$('#filter_dept').on('change', applyFilters);
	$('#filter_desig').on('change', applyFilters);
	$('#filter_branch').on('change', applyFilters);
	$('#clear_filters').on('click', function(){
		$('#filter_dept').val('');
		$('#filter_desig').val('');
		$('#filter_branch').val('');
		applyFilters();
	});

	// -------------------------------
	// Filter employees based on selected filters
	function applyFilters(){
		const dept = $('#filter_dept').val();
		const desig = $('#filter_desig').val();
		const branch = $('#filter_branch').val();

		filteredEmployees = allEmployees.filter(emp => {
			return (dept ? emp.department === dept : true) &&
				   (desig ? emp.designation === desig : true) &&
				   (branch ? emp.branch === branch : true);
		});

		updateDashboard();
	}

	// -------------------------------
	function updateDashboard(){
		// KPIs
		$("#total_emp").text(filteredEmployees.length);
		$("#total_dept").text(new Set(filteredEmployees.map(e=>e.department).filter(Boolean)).size);
		$("#total_desig").text(new Set(filteredEmployees.map(e=>e.designation).filter(Boolean)).size);
		$("#total_branch").text(new Set(filteredEmployees.map(e=>e.branch).filter(Boolean)).size);

		renderDeptChart();
		renderBranchChart();
		renderEmpTypeChart();
		renderGenderChart();
		renderDesigChart();
	}

	// -------------------------------
	function renderBarChart(id,title,map,onClick){
		let chart = initChart(id);

		chart.setOption({
			title:{text:title},
			tooltip:{trigger:'axis'},
			xAxis:{type:'category',data:Object.keys(map)},
			yAxis:{type:'value'},
			series:[{
				type:'bar',
				data:Object.values(map),
				label:{show:true,position:'top'},
				itemStyle:{color:'#4e73df'}
			}]
		});

		if(onClick){
			chart.off('click');
			chart.on('click', p => onClick(p.name));
		}
	}

	// -------------------------------
	function renderDeptChart(){
		let map={};
		filteredEmployees.forEach(e=>{
			if(e.department) map[e.department]=(map[e.department]||0)+1;
		});

		renderBarChart('dept_chart','Department',map,dept=>{
			openEmployeeDialog(`${dept} Department`, filteredEmployees.filter(e=>e.department===dept));
		});
	}

	function renderBranchChart(){
		let map={};
		filteredEmployees.forEach(e=>{
			let b=e.branch||'Blank';
			map[b]=(map[b]||0)+1;
		});

		renderBarChart('branch_chart','Branch',map,b=>{
			openEmployeeDialog(b, filteredEmployees.filter(e=>(e.branch||'Blank')===b));
		});
	}

	function renderEmpTypeChart(){
		let map={};
		filteredEmployees.forEach(e=>{
			let t=e.employment_type||'Blank';
			map[t]=(map[t]||0)+1;
		});

		renderBarChart('emp_type_chart','Employment Type',map,t=>{
			openEmployeeDialog(t, filteredEmployees.filter(e=>(e.employment_type||'Blank')===t));
		});
	}

	function renderGenderChart(){
		let map={};
		filteredEmployees.forEach(e=>{
			let g=e.gender||'Blank';
			map[g]=(map[g]||0)+1;
		});

		let chart = initChart('gender_chart');

		chart.setOption({
			title:{text:'Gender'},
			tooltip:{trigger:'item'},
			legend:{bottom:0},
			series:[{
				type:'pie',
				radius:'60%',
				data:Object.entries(map).map(([k,v])=>({name:k,value:v}))
			}]
		});

		chart.off('click');
		chart.on('click', p=>{
			openEmployeeDialog(p.name, filteredEmployees.filter(e=>(e.gender||'Blank')===p.name));
		});
	}

	function renderDesigChart(){
		let map={};
		filteredEmployees.forEach(e=>{
			if(e.designation) map[e.designation]=(map[e.designation]||0)+1;
		});

		renderBarChart('desig_chart','Designation',map,d=>{
			openEmployeeDialog(d, filteredEmployees.filter(e=>e.designation===d));
		});
	}

	// -------------------------------
	// PREMIUM DIALOG
	// -------------------------------
	function openEmployeeDialog(title, data){

		let dialog = new frappe.ui.Dialog({
			title: `${title} (${data.length})`,
			size:'extra-large',
			fields:[{fieldtype:'HTML', fieldname:'html'}]
		});

		data.sort((a,b)=> (a.employee_name||'').localeCompare(b.employee_name||''));

		let html = `
		<div style="overflow:auto; max-height:70vh; border:1px solid #ddd; border-radius:6px;">
		<table class="table table-bordered" style="min-width:1200px; font-size:13px;">
		<thead style="position:sticky; top:0; background:#f1f3f5;">
		<tr>
			<th>SI</th><th>ID</th><th>Name</th><th>Gender</th>
			<th>Company</th><th>Department</th><th>Designation</th>
			<th>Branch</th><th>Type</th><th>Shift</th>
		</tr>
		</thead><tbody>`;

		data.forEach((e,i)=>{
			html+=`<tr style="background:${i%2?'#fafafa':'#fff'}">
				<td>${i+1}</td>
				<td>${e.ID||''}</td>
				<td>${e.employee_name||''}</td>
				<td>${e.gender||''}</td>
				<td>${e.company||''}</td>
				<td>${e.department||''}</td>
				<td>${e.designation||''}</td>
				<td>${e.branch||''}</td>
				<td>${e.employment_type||''}</td>
				<td>${e.default_shift||''}</td>
			</tr>`;
		});

		html+=`</tbody></table></div>`;

		dialog.fields_dict.html.$wrapper.html(html);
		dialog.show();
	}
};