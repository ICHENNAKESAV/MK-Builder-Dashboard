import frappe

@frappe.whitelist()
def get_stock_entry_report(from_date=None, to_date=None, item_group=None, parent_item_group=None, warehouse=None):

    conditions = " WHERE se.docstatus = 1 "

    if from_date:
        conditions += " AND se.posting_date >= %(from_date)s "

    if to_date:
        conditions += " AND se.posting_date <= %(to_date)s "

    if item_group:
        conditions += " AND sed.item_group = %(item_group)s "

    if parent_item_group:
        conditions += " AND ig.parent_item_group = %(parent_item_group)s "

    if warehouse:
        conditions += " AND se.from_warehouse = %(warehouse)s "

    query = f"""
        SELECT
            se.posting_date AS "Date",
            sed.item_group AS "Item Group",
            sed.item_code AS "Item",
            ig.parent_item_group AS "Parent Item Group",
            sed.cost_center AS "Cost Center",
            se.from_warehouse AS "Source Warehouse",
            sed.uom AS "UOM",
            ROUND(SUM(sed.qty),2) AS "Total Quantity",
            ROUND(SUM(sed.amount),2) AS "Total Amount"
        FROM
            `tabStock Entry` se
        LEFT JOIN
            `tabStock Entry Detail` sed ON se.name = sed.parent
        LEFT JOIN
            `tabItem Group` ig ON sed.item_group = ig.name
        {conditions}
        GROUP BY
            se.posting_date,
            sed.item_code,
            sed.item_group,
            sed.uom,
            sed.cost_center,
            se.from_warehouse,
            ig.parent_item_group
        ORDER BY
            se.posting_date DESC
    """

    return frappe.db.sql(query, {
        "from_date": from_date,
        "to_date": to_date,
        "item_group": item_group,
        "parent_item_group": parent_item_group,
        "warehouse": warehouse
    }, as_dict=True)