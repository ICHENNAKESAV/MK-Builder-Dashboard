import frappe
from frappe.query_builder import DocType, Case, functions as fn
from frappe.utils import flt, getdate


# =========================
# 📦 DELIVERY NOTES
# =========================
@frappe.whitelist()
def get_delivery_notes(from_date=None, to_date=None, customer=None, brick_size=None, company=None):

    conditions = []
    values = {}

    if from_date:
        conditions.append("dn.posting_date >= %(from_date)s")
        values["from_date"] = from_date

    if to_date:
        conditions.append("dn.posting_date <= %(to_date)s")
        values["to_date"] = to_date

    if customer:
        conditions.append("LOWER(dn.customer) = %(customer)s")
        values["customer"] = customer.lower()

    if brick_size:
        conditions.append("LOWER(dni.item_code) = %(brick_size)s")
        values["brick_size"] = brick_size.lower()

    if company:
        conditions.append("LOWER(dn.company) = %(company)s")
        values["company"] = company.lower()

    conditions.append('dni.item_code IN ("CEMENT BRICKS 9\\"X4\\"X3\\"", "CEMENT BRICKS 9\\"X6\\"X3\\"")')

    where_clause = " AND ".join(conditions)
    if where_clause:
        where_clause = " AND " + where_clause

    query = f"""
        SELECT
            dn.name AS id,
            dn.posting_date AS date,
            dn.company,
            dni.item_code AS brick_size,
            dni.qty AS quantity,
            dni.rate AS rate,
            dn.customer AS customer_name,
            dn.grand_total AS grand_amount

        FROM `tabDelivery Note` dn

        INNER JOIN `tabDelivery Note Item` dni
            ON dni.parent = dn.name

        WHERE dn.docstatus = 1
        {where_clause}

        ORDER BY dn.posting_date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)


# =========================
# 🧱 BRICK PRODUCTION
# =========================
@frappe.whitelist()
def get_brick_production(company=None):

    conditions = []
    values = {}

    if company:
        conditions.append("LOWER(bp.company) = %(company)s")
        values["company"] = company.lower()

    conditions.append('bp.brick_size IN ("CEMENT BRICKS 9\\"X4\\"X3\\"", "CEMENT BRICKS 9\\"X6\\"X3\\"")')

    where_clause = ""
    if conditions:
        where_clause = " AND " + " AND ".join(conditions)

    query = f"""
        SELECT
            bp.date,
            bp.company,
            bp.brick_size,
            bp.produced_bricks,
            bp.total_production_cost

        FROM `tabBrick Production` bp

        WHERE bp.docstatus = 1
        {where_clause}

        ORDER BY bp.date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)


# =========================
# 🧪 RAW MATERIAL CONSUMPTION
# =========================
@frappe.whitelist()
def get_material_consumption(company=None):

    conditions = []
    values = {}

    if company:
        conditions.append("LOWER(bp.company) = %(company)s")
        values["company"] = company.lower()

    conditions.append('bp.brick_size IN ("CEMENT BRICKS 9\\"X4\\"X3\\"", "CEMENT BRICKS 9\\"X6\\"X3\\"")')

    where_clause = ""
    if conditions:
        where_clause = " AND " + " AND ".join(conditions)

    query = f"""
        SELECT
            bp.date,
            bp.company,
            b.item_code AS raw_material,

            CASE
                WHEN b.uom = 'Kg'
                THEN b.quantity / 1000
                ELSE b.quantity
            END AS quantity

        FROM `tabBrick Production` bp

        INNER JOIN `tabBricks` b
            ON b.parent = bp.name

        WHERE bp.docstatus = 1
        {where_clause}

        ORDER BY bp.date ASC, b.item_code ASC
    """

    return frappe.db.sql(query, values, as_dict=True)


def _split_multi(value):
    """
    Helper: accepts either a single value or a comma-separated string
    (as sent by the multi-select filter on the frontend) and returns
    a clean list of lowercase values. Returns [] if nothing was passed.
    """
    if not value:
        return []
    if isinstance(value, (list, tuple)):
        items = value
    else:
        items = str(value).split(",")
    return [v.strip().lower() for v in items if v and str(v).strip()]


# =========================
# 🧱 STOCK SUMMARY
# =========================

BRICK_ITEMS = ['CEMENT BRICKS 9"X4"X3"', 'CEMENT BRICKS 9"X6"X3"']


@frappe.whitelist()
def get_stock_balance_summary(company: str, from_date: str, to_date: str):
    sle = DocType("Stock Ledger Entry")
    item = DocType("Item")
    bin_doc = DocType("Bin")
    warehouse_doc = DocType("Warehouse")

    companies = []
    if company:
        # Companies arriving from the frontend are always lower-cased
        # (the multi-select stores option values as c.toLowerCase()).
        # Compare case-insensitively on both sides instead of relying
        # on the DB collation being case-insensitive.
        companies = [c.strip().lower() for c in company.split(",") if c.strip()]

    # -----------------------------------------------------------------
    # 1. Opening / In / Out movement — still computed from the Stock
    #    Ledger Entry for the two brick items, scoped to the selected
    #    date range. This does NOT determine the current balance.
    # -----------------------------------------------------------------
    sle_query = (
        frappe.qb.from_(sle)
        .inner_join(item)
        .on(sle.item_code == item.name)
        .select(
            sle.company,
            sle.item_code.as_("item"),
            item.item_group.as_("item_group"),
            sle.warehouse,
            sle.posting_date,
            sle.actual_qty,
        )
        .where(
            (sle.docstatus < 2)
            & (sle.is_cancelled == 0)
            & (sle.posting_date <= to_date)
            & (sle.item_code.isin(BRICK_ITEMS))
        )
        .orderby(sle.posting_datetime)
        .orderby(sle.creation)
    )

    if companies:
        sle_query = sle_query.where(fn.Lower(sle.company).isin(companies))

    entries = sle_query.run(as_dict=True)

    summary_map = {}
    from_dt = getdate(from_date)
    to_dt = getdate(to_date)

    for entry in entries:
        # NOTE: the query aliases the item code column as "item" (see
        # sle.item_code.as_("item") above), so it must be read back as
        # entry.item — NOT entry.item_code (which doesn't exist on the
        # result and previously evaluated to None, collapsing every
        # brick size into a single "Unknown" bucket).
        key = (entry.company, entry.item, entry.warehouse)

        if key not in summary_map:
            summary_map[key] = {
                "company": entry.company,
                "item": entry.item,
                "item_group": entry.item_group,
                "warehouse": entry.warehouse,
                "opening_qty": 0.0,
                "in_qty": 0.0,
                "out_qty": 0.0,
                "bal_qty": 0.0,  # placeholder — overwritten from Bin below
            }

        row = summary_map[key]
        qty_diff = flt(entry.actual_qty)
        p_date = getdate(entry.posting_date)

        # Opening Qty: Transactions before from_date
        if p_date < from_dt:
            row["opening_qty"] += qty_diff

        # In / Out Qty: Transactions within the from_date and to_date range
        elif from_dt <= p_date <= to_dt:
            if qty_diff >= 0:
                row["in_qty"] += qty_diff
            else:
                row["out_qty"] += abs(qty_diff)

    # -----------------------------------------------------------------
    # 2. Balance Qty — sourced directly from the Bin doctype (the
    #    authoritative, current on-hand quantity per item/warehouse),
    #    scoped to the two brick items only. Bin has no company field,
    #    so join Warehouse to resolve/filter by company.
    # -----------------------------------------------------------------
    bin_query = (
        frappe.qb.from_(bin_doc)
        .inner_join(item)
        .on(bin_doc.item_code == item.name)
        .inner_join(warehouse_doc)
        .on(bin_doc.warehouse == warehouse_doc.name)
        .select(
            warehouse_doc.company.as_("company"),
            bin_doc.item_code.as_("item"),
            item.item_group.as_("item_group"),
            bin_doc.warehouse,
            bin_doc.actual_qty,
        )
        .where(bin_doc.item_code.isin(BRICK_ITEMS))
    )

    if companies:
        bin_query = bin_query.where(fn.Lower(warehouse_doc.company).isin(companies))

    bin_entries = bin_query.run(as_dict=True)

    for entry in bin_entries:
        key = (entry.company, entry.item, entry.warehouse)

        if key not in summary_map:
            # Warehouse/item may have a Bin balance with no movement
            # inside the queried date range — still needs to show up.
            summary_map[key] = {
                "company": entry.company,
                "item": entry.item,
                "item_group": entry.item_group,
                "warehouse": entry.warehouse,
                "opening_qty": 0.0,
                "in_qty": 0.0,
                "out_qty": 0.0,
                "bal_qty": 0.0,
            }

        # Bin.actual_qty is the single source of truth for the balance —
        # not accumulated, just assigned.
        summary_map[key]["bal_qty"] = flt(entry.actual_qty)

    # -----------------------------------------------------------------
    # 3. Format final result list and apply zero-floor guard for Balance Qty
    # -----------------------------------------------------------------
    final_data = []
    for row in summary_map.values():
        # Enforce that balance quantity does not drop below 0
        row["bal_qty"] = max(0.0, flt(row["bal_qty"]))

        # Skip rows with completely zero movement/balance
        if row["bal_qty"] == 0 and row["opening_qty"] == 0 and row["in_qty"] == 0 and row["out_qty"] == 0:
            continue

        final_data.append(row)

    return final_data