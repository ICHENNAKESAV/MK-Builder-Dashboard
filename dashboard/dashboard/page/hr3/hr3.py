# Auto-generated file

import frappe

def get_context(context):
    context.title = "Hr3"


@frappe.whitelist()
def get_employee_list():
    query = """
        SELECT 
           CONCAT('<a href="/app/employee/', employee, '" target="_blank">', employee, '</a>') AS ID,
            employee_name,
            gender,
            company,
            department,
            designation,
            branch,
            employment_type,
            default_shift
        FROM `tabEmployee`
    """
    
    data = frappe.db.sql(query, as_dict=True)
    return data