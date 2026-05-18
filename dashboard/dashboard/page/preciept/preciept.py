import frappe


@frappe.whitelist()
def get_purchase_receipts(filters=None):
    """
    Query 1 – PR-level (header) data.
    Used for:
    - KPIs
    - Monthly Trend
    - Company charts
    - Supplier charts
    - Status charts
    - Cost Centre charts
    """

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    conditions = ["pr.docstatus = 1"]
    values = {}

    if filters:

        if filters.get("company"):
            conditions.append("pr.company = %(company)s")
            values["company"] = filters["company"]

        if filters.get("supplier"):
            conditions.append("pr.supplier = %(supplier)s")
            values["supplier"] = filters["supplier"]

        if filters.get("status"):
            conditions.append("pr.status = %(status)s")
            values["status"] = filters["status"]

        if filters.get("from_date"):
            conditions.append("pr.posting_date >= %(from_date)s")
            values["from_date"] = filters["from_date"]

        if filters.get("to_date"):
            conditions.append("pr.posting_date <= %(to_date)s")
            values["to_date"] = filters["to_date"]

        # Restrict PRs based on matching item filters

        if filters.get("item"):
            conditions.append(
                """
                pr.name IN (
                    SELECT parent
                    FROM `tabPurchase Receipt Item`
                    WHERE item_code = %(item)s
                )
                """
            )
            values["item"] = filters["item"]

        if filters.get("item_group"):
            conditions.append(
                """
                pr.name IN (
                    SELECT parent
                    FROM `tabPurchase Receipt Item`
                    WHERE item_group = %(item_group)s
                )
                """
            )
            values["item_group"] = filters["item_group"]

        if filters.get("warehouse"):
            conditions.append(
                """
                pr.name IN (
                    SELECT parent
                    FROM `tabPurchase Receipt Item`
                    WHERE warehouse = %(warehouse)s
                )
                """
            )
            values["warehouse"] = filters["warehouse"]

    query = f"""
        SELECT
            pr.name                    AS name,
            pr.supplier,
            pr.posting_date,
            pr.company,
            pr.cost_center,
            pr.set_warehouse,
            pr.total_qty,
            pr.grand_total,
            pr.status

        FROM
            `tabPurchase Receipt` pr

        WHERE
            {" AND ".join(conditions)}

        ORDER BY
            pr.posting_date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)


@frappe.whitelist()
def get_purchase_receipt_items(filters=None):
    """
    Query 2 – Item-level (PR + PRI join) data.
    Used for:
    - Warehouse Analysis
    - Item Group Analysis
    - Item Analysis
    - Drill-down tables
    """

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    conditions = ["pr.docstatus = 1"]
    values = {}

    if filters:

        if filters.get("company"):
            conditions.append("pr.company = %(company)s")
            values["company"] = filters["company"]

        if filters.get("supplier"):
            conditions.append("pr.supplier = %(supplier)s")
            values["supplier"] = filters["supplier"]

        if filters.get("status"):
            conditions.append("pr.status = %(status)s")
            values["status"] = filters["status"]

        if filters.get("from_date"):
            conditions.append("pr.posting_date >= %(from_date)s")
            values["from_date"] = filters["from_date"]

        if filters.get("to_date"):
            conditions.append("pr.posting_date <= %(to_date)s")
            values["to_date"] = filters["to_date"]

        if filters.get("item"):
            conditions.append("pri.item_code = %(item)s")
            values["item"] = filters["item"]

        if filters.get("item_group"):
            conditions.append("pri.item_group = %(item_group)s")
            values["item_group"] = filters["item_group"]

        if filters.get("warehouse"):
            conditions.append("pri.warehouse = %(warehouse)s")
            values["warehouse"] = filters["warehouse"]

    query = f"""
        SELECT
            pr.name                    AS name,
            pr.posting_date,
            pr.supplier,
            pr.supplier_name,
            pr.company,
            pr.currency,
            pr.grand_total,
            pr.status,

            pri.item_code,
            pri.item_name,
            pri.item_group,
            pri.qty,
            pri.received_qty,
            pri.rejected_qty,
            pri.rate,
            pri.amount,
            pri.warehouse,
            pri.expense_account

        FROM
            `tabPurchase Receipt` pr

        JOIN
            `tabPurchase Receipt Item` pri
            ON pr.name = pri.parent

        WHERE
            {" AND ".join(conditions)}

        ORDER BY
            pr.posting_date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)