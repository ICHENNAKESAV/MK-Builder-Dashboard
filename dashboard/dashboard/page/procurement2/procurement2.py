# Auto-generated file
import frappe

@frappe.whitelist()
def get_material_issue_summary(company=None, from_date=None, to_date=None, item_group=None):
    """
    Groups aggregated Material Issue amounts strictly by Cost Center.
    """
    conditions = []
    values = {}

    if company:
        conditions.append("`tabStock Entry`.company = %(company)s")
        values["company"] = company
    if from_date:
        conditions.append("`tabStock Entry`.posting_date >= %(from_date)s")
        values["from_date"] = from_date
    if to_date:
        conditions.append("`tabStock Entry`.posting_date <= %(to_date)s")
        values["to_date"] = to_date
    if item_group:
        conditions.append("`tabItem`.item_group = %(item_group)s")
        values["item_group"] = item_group

    where_clause = " AND " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT
            IFNULL(`tabStock Entry Detail`.cost_center, 'Not Specified') AS cost_center,
            SUM(`tabStock Entry Detail`.amount) AS amount
        FROM
            `tabStock Entry Detail`
        INNER JOIN
            `tabStock Entry` ON `tabStock Entry Detail`.parent = `tabStock Entry`.name
        INNER JOIN
            `tabItem` ON `tabStock Entry Detail`.item_code = `tabItem`.name
        WHERE
            `tabStock Entry`.docstatus = 1
            AND `tabStock Entry`.purpose = 'Material Issue'
            {where_clause}
        GROUP BY
            `tabStock Entry Detail`.cost_center
        ORDER BY
            amount DESC;
    """
    return frappe.db.sql(query, values, as_dict=True)


@frappe.whitelist()
def get_purchase_receipt_summary(company=None, from_date=None, to_date=None, item_group=None, group_by_period="Monthly"):
    """
    Groups aggregated Purchase Receipt amounts dynamically with human-readable X-axis labels.
    """
    conditions = []
    values = {}

    if company:
        conditions.append("`tabPurchase Receipt`.company = %(company)s")
        values["company"] = company
    if from_date:
        conditions.append("`tabPurchase Receipt`.posting_date >= %(from_date)s")
        values["from_date"] = from_date
    if to_date:
        conditions.append("`tabPurchase Receipt`.posting_date <= %(to_date)s")
        values["to_date"] = to_date
    if item_group:
        conditions.append("`tabItem`.item_group = %(item_group)s")
        values["item_group"] = item_group

    where_clause = " AND " + " AND ".join(conditions) if conditions else ""

    # Updated logic for custom X-Axis sorting keys vs human-friendly display labels
    if group_by_period == "Weekly":
        # Displays: "W24 2026"
        date_expression = "DATE_FORMAT(`tabPurchase Receipt`.posting_date, 'W%%v %%Y')"
        sort_expression = "DATE_FORMAT(`tabPurchase Receipt`.posting_date, '%%Y-%%v')"
    elif group_by_period == "Quarterly":
        # Displays: "2026-Q2"
        date_expression = "CONCAT(YEAR(`tabPurchase Receipt`.posting_date), '-Q', QUARTER(`tabPurchase Receipt`.posting_date))"
        sort_expression = date_expression
    elif group_by_period == "Yearly":
        # Displays: "2026"
        date_expression = "YEAR(`tabPurchase Receipt`.posting_date)"
        sort_expression = date_expression
    else:  # Default to Monthly
        # Displays EXACTLY: "Jan 2026", "Feb 2026"
        date_expression = "DATE_FORMAT(`tabPurchase Receipt`.posting_date, '%%b %%Y')"
        # Keeps chronological database sorting intact (otherwise "Feb" comes before "Jan" alphabetically)
        sort_expression = "DATE_FORMAT(`tabPurchase Receipt`.posting_date, '%%Y-%%m')"

    query = f"""
        SELECT
            {date_expression} AS period,
            SUM(`tabPurchase Receipt Item`.base_net_amount + IFNULL(`tabPurchase Receipt Item`.item_tax_amount, 0)) AS Total_purchase_amount
        FROM `tabPurchase Receipt`
        INNER JOIN `tabPurchase Receipt Item` ON `tabPurchase Receipt Item`.parent = `tabPurchase Receipt`.name
        INNER JOIN `tabItem` ON `tabItem`.name = `tabPurchase Receipt Item`.item_code
        WHERE
            `tabPurchase Receipt`.docstatus = 1
            {where_clause}
        GROUP BY
            {sort_expression}, period
        ORDER BY
            {sort_expression} ASC;
    """
    return frappe.db.sql(query, values, as_dict=True)