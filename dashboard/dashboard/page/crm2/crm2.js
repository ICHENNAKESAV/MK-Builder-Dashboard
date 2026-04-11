frappe.pages['crm2'].on_page_load = function(wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        single_column: true
    });

       // -------------------------------
    // FIX: REMOVE TOP EMPTY SPACE
    // -------------------------------
    // 1. Remove padding from the main wrapper
    $(wrapper).css('padding', '0px');
    
    // 2. Hide the default Frappe Page Head (where the title usually sits)
    $(wrapper).find('.page-head').hide();
    
    // 3. Ensure the body fills the available height
    $(page.body).parent().css('padding', '0px');

    
    // -------------------------------
    // LAYOUT
    // -------------------------------
    $(page.body).html(`
    <div style="display:flex; height:100vh; overflow:hidden;">

        <!-- RIGHT SIDE -->
        <div style="flex:1; display:flex; flex-direction:column;">

            <!-- HEADER -->
            <div style="
                height:60px;
                background:#fff;
                display:flex;
                align-items:center;
                padding:0 20px;
                box-shadow:0 2px 5px rgba(0,0,0,0.1);
            ">

                <h3 style="margin:0;">CRM Dashboard</h3>
            </div>

            <!-- MAIN CONTENT -->
            <div id="app-content" style="
                flex:1;
                overflow:auto;
                background:#f4f6f9;
                padding:20px;
            ">

                <!-- FILTERS -->
                <div id="crm_filters" style="
                    display:flex;
                    flex-wrap: wrap;
                    gap:15px;
                    margin-bottom:25px;
                "></div>

                <!-- CHARTS -->
                <div style="
                    display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(400px,1fr));
                    gap:20px;
                ">
                    ${chartCard("chart-requirements")}
                    ${chartCard("chart-category-status")}
                    ${chartCard("chart-department")}
                    ${chartCard("chart-financials")}
                    ${chartCard("chart-occupation")}
                    ${chartCard("chart-residence")}
                    ${chartCard("chart-status")}
                </div>

            </div>

        </div>

    </div>
    `);

    // -------------------------------
    // NAVIGATION
    // -------------------------------
    window.navigateTo = function(route){
        frappe.set_route(route);
        setTimeout(()=> location.reload(), 100);
    };

    // -------------------------------
    // FUNCTIONS FOR MODERN UI ELEMENTS
    // -------------------------------
    function chartCard(id){
        return `
        <div style="
            background:#fff;
            border-radius:10px;
            padding:15px;
            box-shadow:0 2px 8px rgba(0,0,0,0.08);
            height:400px;
        ">
            <div id="${id}" style="width:100%; height:100%;"></div>
        </div>`;
    }

    function filterCard(label, type){
        return `
        <div style="flex:1 1 220px; min-width:220px;">
            <label style="font-weight:600; display:block; margin-bottom:6px; color:#444;">${label}</label>
            <div style="position:relative;">
                <div class="dropdown-btn" id="${type}-btn" style="
                    border:1.5px solid #ccc; padding:6px 10px; cursor:pointer; background:#fff; border-radius:6px;
                    width:100%; text-align:left; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
                    onclick="toggleDropdown('${type}-dropdown')">Select
                </div>
                <div class="dropdown-content" id="${type}-dropdown" style="
                    display:none; position:absolute; background:#fff; border:1px solid #ccc; width:100%; max-height:200px; overflow-y:auto; z-index:1000; padding:8px; font-size:13px; border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
                </div>
            </div>
        </div>`;
    }

    // -------------------------------
    // GLOBAL DATA
    // -------------------------------
    let req_data=[], cat_data=[], cust_data=[], mod_data=[];
    let selected={block:[], project:[], occupation:[], residence:[]};
    let charts = {};

    // -------------------------------
    // API CALLS
    // -------------------------------
    frappe.call({ method:"dashboard.dashboard.page.crm2.crm2.get_crm_dashboard_data",
        callback:r=>{ req_data=r.message.requirements || []; cat_data=r.message.category_status || []; init(); } 
    });
    frappe.call({ method:"dashboard.dashboard.page.crm2.crm2.get_customer_basic_details",
        callback:r=>{ cust_data=r.message || []; init(); } 
    });
    frappe.call({ method:"dashboard.dashboard.page.crm2.crm2.get_customer_modifications_data",
        callback:r=>{ mod_data=r.message || []; init(); } 
    });

    function init(){
        if(!req_data.length || !cust_data.length || !mod_data.length) return;
        // -------------------------------
        // ADD FILTERS
        // -------------------------------
        let $filters = $('#crm_filters');
        $filters.html(
            filterCard("Block","block") +
            filterCard("Project","project") +
            filterCard("Occupation","occupation") +
            filterCard("Residence","residence")
        );

        populateFilters();
        applyFilters();
    }

    // -------------------------------
    // DROPDOWN LOGIC
    // -------------------------------
    window.toggleDropdown = id => {
        let el = document.getElementById(id);
        el.style.display = el.style.display==="block"?"none":"block";
    };

    document.addEventListener('click', function(e) {
        document.querySelectorAll('.dropdown-content').forEach(d=>{
            if(!d.parentElement.contains(e.target)) d.style.display='none';
        });
    });

    function populateFilters(){
        fill("block",[...new Set(cust_data.map(r=>r.Block).filter(Boolean))].sort());
        fill("project",[...new Set(cust_data.map(r=>r.Project).filter(Boolean))].sort());
        fill("occupation",[...new Set(cust_data.map(r=>r.Occupation).filter(Boolean))].sort());
        fill("residence",[...new Set(cust_data.map(r=>r.Residence).filter(Boolean))].sort());
    }

    function fill(type,vals){
    let d=document.getElementById(`${type}-dropdown`);
    d.innerHTML=`
        <div style="margin-bottom:5px;">
            <button onclick="selectAll('${type}')">All</button>
            <button onclick="clearAll('${type}')">Clear</button>
        </div>`;
    vals.forEach(v=>{
        d.innerHTML+=`
        <label style="display:block; margin-bottom:5px; cursor:pointer;">
            <input type="checkbox" value="${v}" onchange="updateFilter('${type}')"> ${v}
        </label>`;
    });
}

    window.selectAll=type=>{
        document.querySelectorAll(`#${type}-dropdown input`).forEach(cb=>cb.checked=true);
        updateFilter(type);
    };
    window.clearAll=type=>{
        document.querySelectorAll(`#${type}-dropdown input`).forEach(cb=>cb.checked=false);
        updateFilter(type);
    };
    window.updateFilter=type=>{
        let checked = Array.from(document.querySelectorAll(`#${type}-dropdown input:checked`));
        selected[type] = checked.map(e=>e.value);
        let btn = document.getElementById(`${type}-btn`);
        btn.innerText = selected[type].length ? selected[type].join(', ') : "Select";
        applyFilters();
    };

    function match(v,list){ return !list.length || list.includes(v); }

    // -------------------------------
    // APPLY FILTERS
    // -------------------------------
    function applyFilters(){
        let req=req_data.filter(r => match(r.Block,selected.block) && match(r.Project,selected.project));
        let cat=cat_data.filter(r => match(r.block,selected.block) && match(r.project,selected.project));
        let cust=cust_data.filter(r => match(r.Block,selected.block) && match(r.Project,selected.project) && match(r.Occupation,selected.occupation) && match(r.Residence,selected.residence));
        let mods=mod_data.filter(r => match(r.Block,selected.block));

        renderRequirementsChart(req);
        renderCategoryStatusChart(cat);
        renderDepartmentChart(mods);
        renderFinancialsChart(mods);
        renderSimpleChart(cust,"Occupation","chart-occupation");
        renderSimpleChart(cust,"Residence","chart-residence");
        renderStatusChart(cust);
    }

    // -------------------------------
    // CHART FUNCTIONS
    // -------------------------------
    function initChart(id){ if(charts[id]) charts[id].dispose(); charts[id]=echarts.init(document.getElementById(id)); return charts[id]; }
    function labelCfg(){ return {show:true, position:'top'}; }

    function renderRequirementsChart(data){
        let cats=["Tiles","Doors","Electrical","Paints","CP And Sanitary"];
        let y=[],n=[],b=[];
        cats.forEach(c=>{
            let yy=0,nn=0,bb=0;
            data.forEach(r=>{
                let v=(r[c]||'').trim();
                if(v==="Yes") yy++;
                else if(v==="No") nn++;
                else bb++;
            });
            y.push(yy); n.push(nn); b.push(bb);
        });
        let chart=initChart('chart-requirements');
        chart.setOption({
            title:{text:'Requirements'},
            tooltip:{trigger:'axis'},
            legend:{data:['Yes','No','Blank']},
            xAxis:{type:'category',data:cats},
            yAxis:{type:'value'},
            series:[
                {name:'Yes',type:'bar',data:y,label:labelCfg()},
                {name:'No',type:'bar',data:n,label:labelCfg()},
                {name:'Blank',type:'bar',data:b,label:labelCfg()}
            ]
        });
        chart.off('click');
        chart.on('click',p=>{
            let f=data.filter(r=>{
                let v=(r[p.name]||'').trim();
                return p.seriesName==="Blank" ? !v : v===p.seriesName;
            });
            showDialog(f,`${p.name}-${p.seriesName}`);
        });
    }

    function renderCategoryStatusChart(data){
        let cats=["Tiles","Paints","CP And Sanitary","Electrical","Doors"];
        let comp=[],pend=[];
        cats.forEach(c=>{
            let c1=0,p1=0;
            data.forEach(r=>{
                if(r.category===c){
                    r.status==="Completed"?c1++:p1++;
                }
            });
            comp.push(c1); pend.push(p1);
        });
        let chart=initChart('chart-category-status');
        chart.setOption({
            title:{text:'Category Status'},
            tooltip:{trigger:'axis'},
            legend:{data:['Completed','Pending']},
            xAxis:{type:'category',data:cats},
            yAxis:{type:'value'},
            series:[
                {name:'Completed',type:'bar',data:comp,label:labelCfg()},
                {name:'Pending',type:'bar',data:pend,label:labelCfg()}
            ]
        });
        chart.off('click');
        chart.on('click',p=>{
            let f=data.filter(r => r.category===p.name && r.status===p.seriesName);
            showDialog(f,`${p.name}-${p.seriesName}`);
        });
    }

    function renderDepartmentChart(data){
        let map={};
        data.forEach(r => {
            if(r.Department) map[r.Department]=(map[r.Department]||0)+1;
        });
        let chart=initChart('chart-department');
        chart.setOption({
            title:{text:'Department-wise Count'},
            tooltip:{trigger:'axis'},
            xAxis:{type:'category',data:Object.keys(map)},
            yAxis:{type:'value'},
            series:[{type:'bar',data:Object.values(map),label:labelCfg()}]
        });
        chart.off('click');
        chart.on('click',p=>{
            let f=data.filter(r => r.Department===p.name);
            showDialog(f,`Department - ${p.name}`);
        });
    }

    function renderFinancialsChart(data){
        let totals={"Total Amount":0,"Amount Paid":0,"Balance Amount":0};
        data.forEach(r=>{
            totals["Total Amount"] += r["Total Amount"]||0;
            totals["Amount Paid"] += r["Amount Paid"]||0;
            totals["Balance Amount"] += r["Balance Amount"]||0;
        });
        let chart=initChart('chart-financials');
        chart.setOption({
            title:{text:'Financial Overview'},
            tooltip:{trigger:'axis'},
            xAxis:{type:'category',data:Object.keys(totals)},
            yAxis:{type:'value'},
            series:[{type:'bar',data:Object.values(totals),label:labelCfg()}]
        });
        chart.off('click');
        chart.on('click',p=>{
            showDialog(data, `Financial Drill-down - ${p.name}`);
        });
    }

    function renderSimpleChart(data, field, id){
        let map={};
        data.forEach(r=>{
            let k=r[field]||"Unknown";
            map[k]=(map[k]||0)+1;
        });
        let chart=initChart(id);
        chart.setOption({
            title:{text:field},
            tooltip:{trigger:'axis'},
            xAxis:{type:'category',data:Object.keys(map)},
            yAxis:{type:'value'},
            series:[{type:'bar',data:Object.values(map),label:labelCfg()}]
        });
        chart.off('click');
        chart.on('click',p=>{
            let f=data.filter(r=>(r[field]||"Unknown")===p.name);
            showDialog(f,`${field}-${p.name}`);
        });
    }

    function renderStatusChart(data){
        let map={};
        data.forEach(r=>{
            let s=(r["Flat Status"]||"Unknown").trim();
            map[s]=(map[s]||0)+1;
        });
        let chart=initChart('chart-status');
        chart.setOption({
            title:{text:'Flat Status'},
            tooltip:{trigger:'axis'},
            xAxis:{type:'category',data:Object.keys(map)},
            yAxis:{type:'value'},
            series:[{type:'bar',data:Object.values(map),label:labelCfg()}]
        });
        chart.off('click');
        chart.on('click',p=>{
            let f=data.filter(r=>(r["Flat Status"]||"Unknown").trim()===p.name);
            showDialog(f,`Status-${p.name}`);
        });
    }

    // -------------------------------
    // DIALOG FUNCTION
    // -------------------------------
    function showDialog(data, title){
        if(!data.length){
            frappe.msgprint("No records found");
            return;
        }
        let cols=Object.keys(data[0]);
        let html=`<div style="overflow-x:auto; max-height:500px; border:1px solid #ddd;">
            <table class="table table-bordered" style="min-width:1200px; font-size:12px;">
            <thead style="position:sticky; top:0; background:#f7f7f7; z-index:10;">
            <tr><th>SI No</th>`;
        cols.forEach(c=>html+=`<th style="min-width:140px;">${c}</th>`);
        html+=`</tr></thead><tbody>`;
        data.forEach((r,i)=>{
            html+=`<tr style="background:${i%2?'#fafafa':'#fff'}"><td>${i+1}</td>`;
            cols.forEach(c=>html+=`<td>${r[c] ?? ''}</td>`);
            html+=`</tr>`;
        });
        html+=`</tbody></table></div>`;

        let d=new frappe.ui.Dialog({
            title:`${title} (${data.length})`,
            size:'extra-large',
            fields:[{fieldtype:'HTML', fieldname:'html'}]
        });
        d.fields_dict.html.$wrapper.html(html);
        d.show();
    }

};