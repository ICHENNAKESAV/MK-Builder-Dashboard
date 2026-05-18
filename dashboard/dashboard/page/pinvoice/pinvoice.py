import frappe

@frappe.whitelist()
def get_purchase_invoices(filters=None):
    """
    Query 1 – PI-level (header) data.
    Used for: KPIs, Monthly Trend, Company, Supplier, Cost Centre, Status charts.
    Drill-down table shows Purchase Invoice level columns only.
    """

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    conditions = ["pi.docstatus = 1"]
    values = {}

    if filters:

        if filters.get("company"):
            conditions.append("pi.company = %(company)s")
            values["company"] = filters["company"]

        if filters.get("supplier"):
            conditions.append("pi.supplier = %(supplier)s")
            values["supplier"] = filters["supplier"]

        if filters.get("status"):
            conditions.append("pi.status = %(status)s")
            values["status"] = filters["status"]

        if filters.get("from_date"):
            conditions.append("pi.posting_date >= %(from_date)s")
            values["from_date"] = filters["from_date"]

        if filters.get("to_date"):
            conditions.append("pi.posting_date <= %(to_date)s")
            values["to_date"] = filters["to_date"]

        # Restrict PI list based on matching invoice items
        if filters.get("item"):
            conditions.append(
                "pi.name IN (SELECT parent FROM `tabPurchase Invoice Item` WHERE item_code = %(item)s)"
            )
            values["item"] = filters["item"]

        if filters.get("warehouse"):
            conditions.append(
                "pi.name IN (SELECT parent FROM `tabPurchase Invoice Item` WHERE warehouse = %(warehouse)s)"
            )
            values["warehouse"] = filters["warehouse"]

    query = f"""
        SELECT
            pi.name                    AS purchase_invoice,
            pi.supplier,
            pi.posting_date,
            pi.due_date,
            pi.bill_no,
            pi.bill_date,
            pi.company,
            pi.cost_center,
            pi.status,
            pi.set_warehouse,
            pi.total_qty,
            pi.grand_total,
            pi.outstanding_amount
        FROM
            `tabPurchase Invoice` pi
        WHERE
            {" AND ".join(conditions)}
        ORDER BY
            pi.posting_date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)


@frappe.whitelist()
def get_purchase_invoice_items(filters=None):
    """
    Query 2 – Item-level (PI + PII join) data.
    Used for: Warehouse, Item, Supplier item analytics and drill-down tables.
    """

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    conditions = ["pi.docstatus = 1"]
    values = {}

    if filters:

        if filters.get("company"):
            conditions.append("pi.company = %(company)s")
            values["company"] = filters["company"]

        if filters.get("supplier"):
            conditions.append("pi.supplier = %(supplier)s")
            values["supplier"] = filters["supplier"]

        if filters.get("status"):
            conditions.append("pi.status = %(status)s")
            values["status"] = filters["status"]

        if filters.get("from_date"):
            conditions.append("pi.posting_date >= %(from_date)s")
            values["from_date"] = filters["from_date"]

        if filters.get("to_date"):
            conditions.append("pi.posting_date <= %(to_date)s")
            values["to_date"] = filters["to_date"]

        if filters.get("item"):
            conditions.append("pii.item_code = %(item)s")
            values["item"] = filters["item"]

        if filters.get("warehouse"):
            conditions.append("pii.warehouse = %(warehouse)s")
            values["warehouse"] = filters["warehouse"]

    query = f"""
        SELECT
            pi.name                    AS purchase_invoice,
            pi.posting_date,
            pi.due_date,
            pi.bill_no,
            pi.bill_date,
            pi.supplier,
            pi.supplier_name,
            pi.company,
            pi.currency,
            pi.status,
            pi.total_qty              AS pi_total_qty,
            pi.grand_total,
            pi.outstanding_amount,

            pii.item_code,
            pii.item_group,
            pii.qty,
            pii.received_qty,
            pii.rate,
            pii.amount,
            pii.warehouse,
            pii.expense_account

        FROM
            `tabPurchase Invoice` pi
        JOIN
            `tabPurchase Invoice Item` pii
            ON pi.name = pii.parent

        WHERE
            {" AND ".join(conditions)}

        ORDER BY
            pi.posting_date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)