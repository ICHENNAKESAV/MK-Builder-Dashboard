import frappe
import json

@frappe.whitelist()
def get_nmr_worksheet_data(filters=None):
    # Safely parse filters if passed as a JSON string from the frontend
    if isinstance(filters, str):
        filters = json.loads(filters)
    filters = filters or {}

    # Define DocTypes using Query Builder
    nmr_master = frappe.qb.DocType("NMR Master Worksheet")
    nmr_detail = frappe.qb.DocType("NMR Worksheet Detail")

    # Construct the base query
    query = (
        frappe.qb.from_(nmr_master)
        .inner_join(nmr_detail)
        .on(nmr_master.name == nmr_detail.parent)
        .select(
            nmr_master.name.as_("name"),
            nmr_master.date.as_("date"),
            nmr_master.supplier.as_("contractor"),
            nmr_master.project.as_("project"),
            nmr_detail.required_area.as_("required_area"),
            nmr_detail.labor_category.as_("nmr_category"),
            nmr_detail.nature_of_work.as_("nature_of_work"),
            nmr_detail.number_of_people.as_("number_of_people"),
            nmr_detail.regular_hours.as_("regular_hours"),
            nmr_detail.ot_hours.as_("ot_hours"),
            nmr_detail.total_hours.as_("total_hours"),
            nmr_detail.regular_amount.as_("regular_amount"),
            nmr_detail.ot_amount.as_("food_and_travel_expenses"),
            nmr_detail.total_amount.as_("total_amount")
        )
        .where(nmr_master.docstatus == 1)
        .orderby(nmr_master.date, order=frappe.qb.desc)
        .orderby(nmr_master.supplier, order=frappe.qb.asc)
    )

    # Execute the query and return the results as a list of dictionaries
    return query.run(as_dict=True)

@frappe.whitelist()
def get_nmr_daily_summary_report_data(filters=None):
    # Safely parse filters if passed as a JSON string from the frontend
    if isinstance(filters, str):
        filters = json.loads(filters)
    filters = filters or {}

    # Define report columns (Optional for standard Frappe Reports, but harmless)
    columns = [
        {"fieldname": "date", "label": "Date", "fieldtype": "Date", "width": 110},
        {"fieldname": "project", "label": "Project", "fieldtype": "Data", "width": 140},
        {"fieldname": "required_area", "label": "Required Area", "fieldtype": "Data", "width": 140},
        {"fieldname": "contractor", "label": "Contractor", "fieldtype": "Data", "width": 180},
        {"fieldname": "nmr_category", "label": "Labor Category", "fieldtype": "Data", "width": 150},
        {"fieldname": "number_of_people", "label": "No. of People", "fieldtype": "Float", "width": 110},
        {"fieldname": "work_start_time", "label": "Start Time", "fieldtype": "Time", "width": 100},
        {"fieldname": "work_end_time", "label": "End Time", "fieldtype": "Time", "width": 100},
        {"fieldname": "total_hours", "label": "Total Hours", "fieldtype": "Float", "width": 100},
        {"fieldname": "ot_hours", "label": "OT Hours", "fieldtype": "Float", "width": 100}
    ]

    # Define DocTypes using Query Builder
    nmr_master = frappe.qb.DocType("NMR Master Worksheet")
    nmr_detail = frappe.qb.DocType("NMR Worksheet Detail")

    # Construct the base query
    query = (
        frappe.qb.from_(nmr_master)
        .inner_join(nmr_detail)
        .on(nmr_master.name == nmr_detail.parent)
        .select(
            nmr_master.date.as_("date"),
            nmr_master.project.as_("project"),  # Added so the frontend can filter by Project
            nmr_detail.required_area.as_("required_area"),
            nmr_master.supplier.as_("contractor"),
            nmr_detail.labor_category.as_("nmr_category"),
            nmr_detail.number_of_people.as_("number_of_people"),
            nmr_detail.work_start_time.as_("work_start_time"),
            nmr_detail.work_end_time.as_("work_end_time"),
            nmr_detail.total_hours.as_("total_hours"),
            nmr_detail.ot_hours.as_("ot_hours")
        )
        .where(nmr_master.docstatus == 1)
        .orderby(nmr_master.date, order=frappe.qb.desc)
        .orderby(nmr_master.supplier, order=frappe.qb.asc)
    )

    # Execute the query
    rows = query.run(as_dict=True)

    return {
        "columns": columns,
        "data": rows
    }