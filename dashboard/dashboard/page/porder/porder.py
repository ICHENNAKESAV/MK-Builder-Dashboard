# pyrefly: ignore [missing-import]

import frappe


@frappe.whitelist()
def get_purchase_orders(filters=None):
    """
    Query 1 – PO-level (header) data.
    Used for: KPIs, Monthly Trend, Company, Supplier, Cost Centre, Status charts.
    Drill-down table shows PO-level columns (no item details).
    """

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    conditions = ["po.docstatus = 1"]
    values = {}

    if filters:

        if filters.get("company"):
            conditions.append("po.company = %(company)s")
            values["company"] = filters["company"]

        if filters.get("supplier"):
            conditions.append("po.supplier = %(supplier)s")
            values["supplier"] = filters["supplier"]

        if filters.get("status"):
            conditions.append("po.status = %(status)s")
            values["status"] = filters["status"]

        if filters.get("from_date"):
            conditions.append("po.transaction_date >= %(from_date)s")
            values["from_date"] = filters["from_date"]

        if filters.get("to_date"):
            conditions.append("po.transaction_date <= %(to_date)s")
            values["to_date"] = filters["to_date"]

        # When item / item_group / warehouse filters are active we still
        # restrict the PO list to only those POs that contain matching items.
        if filters.get("item"):
            conditions.append(
                "po.name IN (SELECT parent FROM `tabPurchase Order Item` WHERE item_code = %(item)s)"
            )
            values["item"] = filters["item"]

        if filters.get("item_group"):
            conditions.append(
                "po.name IN (SELECT parent FROM `tabPurchase Order Item` WHERE item_group = %(item_group)s)"
            )
            values["item_group"] = filters["item_group"]

        if filters.get("warehouse"):
            conditions.append(
                "po.name IN (SELECT parent FROM `tabPurchase Order Item` WHERE warehouse = %(warehouse)s)"
            )
            values["warehouse"] = filters["warehouse"]

    query = f"""
        SELECT
            po.name,
            po.supplier,
            po.transaction_date,
            po.schedule_date,
            po.supplier_qutation_no_,
            po.supplier_quotation_date,
            po.company,
            po.cost_center,
            po.status,
            po.set_warehouse,
            po.total_qty,
            po.grand_total
        FROM
            `tabPurchase Order` po
        WHERE
            {" AND ".join(conditions)}
        ORDER BY
            po.transaction_date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)


@frappe.whitelist()
def get_purchase_order_items(filters=None):
    """
    Query 2 – Item-level (PO + POI join) data.
    Used for: Warehouse, Item Group, Item charts and their drill-down tables.
    """

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    conditions = ["po.docstatus = 1"]
    values = {}

    if filters:

        if filters.get("company"):
            conditions.append("po.company = %(company)s")
            values["company"] = filters["company"]

        if filters.get("supplier"):
            conditions.append("po.supplier = %(supplier)s")
            values["supplier"] = filters["supplier"]

        if filters.get("status"):
            conditions.append("po.status = %(status)s")
            values["status"] = filters["status"]

        if filters.get("from_date"):
            conditions.append("po.transaction_date >= %(from_date)s")
            values["from_date"] = filters["from_date"]

        if filters.get("to_date"):
            conditions.append("po.transaction_date <= %(to_date)s")
            values["to_date"] = filters["to_date"]

        if filters.get("item"):
            conditions.append("poi.item_code = %(item)s")
            values["item"] = filters["item"]

        if filters.get("item_group"):
            conditions.append("poi.item_group = %(item_group)s")
            values["item_group"] = filters["item_group"]

        if filters.get("warehouse"):
            conditions.append("poi.warehouse = %(warehouse)s")
            values["warehouse"] = filters["warehouse"]

    query = f"""
        SELECT
            po.name,
            po.supplier,
            po.transaction_date,
            po.schedule_date,
            po.supplier_qutation_no_,
            po.supplier_quotation_date,
            po.company,
            po.cost_center,
            po.status,
            po.set_warehouse,
            po.total_qty        AS po_total_qty,
            po.grand_total      AS po_grand_total,
            poi.item_code,
            poi.item_name,
            poi.item_group,
            poi.qty,
            poi.received_qty,
            poi.rate,
            poi.amount,
            poi.schedule_date   AS item_schedule_date,
            poi.warehouse
        FROM
            `tabPurchase Order` po
        JOIN
            `tabPurchase Order Item` poi
            ON po.name = poi.parent
        WHERE
            {" AND ".join(conditions)}
        ORDER BY
            po.transaction_date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)