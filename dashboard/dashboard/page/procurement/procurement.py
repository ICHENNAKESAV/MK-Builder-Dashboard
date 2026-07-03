import frappe
import json
from frappe.utils import flt


# ============================================================
# FILTER OPTIONS — powers the pure-JS filter bar on the client.
# Only returns values that actually occur in submitted documents,
# instead of the entire Company/Supplier/Item/Project doctype.
# ============================================================
@frappe.whitelist()
def get_filter_options():
    companies = frappe.db.sql("""
        SELECT DISTINCT company FROM `tabPurchase Order`
        WHERE docstatus = 1 AND company IS NOT NULL AND company != ''
        ORDER BY company
    """, as_dict=1)

    suppliers = frappe.db.sql("""
        SELECT DISTINCT supplier FROM `tabPurchase Order`
        WHERE docstatus = 1 AND supplier IS NOT NULL AND supplier != ''
        ORDER BY supplier
    """, as_dict=1)

    projects = frappe.db.sql("""
        SELECT DISTINCT project FROM (
            SELECT project FROM `tabPurchase Order` WHERE docstatus = 1
            UNION
            SELECT project FROM `tabPurchase Receipt` WHERE docstatus = 1
            UNION
            SELECT project FROM `tabPurchase Invoice` WHERE docstatus = 1
        ) t
        WHERE project IS NOT NULL AND project != ''
        ORDER BY project
    """, as_dict=1)

    items = frappe.db.sql("""
        SELECT DISTINCT poi.item_code
        FROM `tabPurchase Order Item` poi
        INNER JOIN `tabPurchase Order` po ON po.name = poi.parent
        WHERE po.docstatus = 1
        ORDER BY poi.item_code
    """, as_dict=1)

    return {
        "companies": [r.company for r in companies],
        "suppliers": [r.supplier for r in suppliers],
        "projects": [r.project for r in projects],
        "items": [r.item_code for r in items],
    }


# ============================================================
# UTILITIES
# ============================================================
def parse_filters(filters):
    """Safely extracts JSON payloads from client request vectors."""
    if isinstance(filters, str):
        try:
            filters = json.loads(filters)
        except ValueError:
            filters = {}
    return filters or {}


def _as_list(value):
    """Normalizes a multi-select filter value (string, list, or a JSON-encoded
    list sent from the client) into a clean list of non-empty values."""
    if value is None or value == "":
        return []
    if isinstance(value, (list, tuple)):
        return [v for v in value if v]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [v for v in parsed if v]
        except ValueError:
            pass
        return [value]
    return []


def _in_clause(values_dict, key_prefix, items):
    """Builds `%(key_0)s, %(key_1)s...` placeholders and fills values_dict."""
    placeholders = []
    for i, v in enumerate(items):
        pkey = f"{key_prefix}_{i}"
        placeholders.append(f"%({pkey})s")
        values_dict[pkey] = v
    return ", ".join(placeholders)


def build_conditions(filters, alias, date_col, item_alias=None, item_table=None):
    """
    Builds a WHERE clause (string) + params dict for a parent-doctype-level query.
    company / supplier / project are multi-select — each becomes an IN (...) clause.

    alias      : SQL alias of the parent doctype in the query (e.g. 'po', 'pr', 'pi')
    date_col   : the date fieldname on the parent doctype to filter from_date/to_date against
    item_alias / item_table : if given and item_code(s) are selected, an EXISTS
                 subquery against that child table is added (so item filtering never
                 duplicates parent rows).
    """
    conditions = [f"{alias}.docstatus = 1"]
    values = {}

    for fkey, col in (("company", "company"), ("supplier", "supplier"), ("project", "project")):
        items = _as_list(filters.get(fkey))
        if items:
            placeholders = _in_clause(values, fkey, items)
            conditions.append(f"{alias}.{col} IN ({placeholders})")

    if filters.get("from_date"):
        conditions.append(f"{alias}.{date_col} >= %(from_date)s")
        values["from_date"] = filters["from_date"]

    if filters.get("to_date"):
        conditions.append(f"{alias}.{date_col} <= %(to_date)s")
        values["to_date"] = filters["to_date"]

    item_items = _as_list(filters.get("item_code"))
    if item_items and item_alias and item_table:
        placeholders = _in_clause(values, "item_code", item_items)
        conditions.append(f"""EXISTS (
            SELECT 1 FROM `{item_table}` {item_alias}
            WHERE {item_alias}.parent = {alias}.name AND {item_alias}.item_code IN ({placeholders})
        )""")

    return " AND ".join(conditions), values


def apply_direct_item_filter(filters, where, values, item_alias="poi"):
    """For queries already joined directly to a *Item child table, adds an
    IN clause against that alias (used instead of build_conditions' EXISTS
    subquery when the item table is already part of the FROM/JOIN)."""
    item_items = _as_list(filters.get("item_code"))
    if item_items:
        placeholders = _in_clause(values, "item_code", item_items)
        where += f" AND {item_alias}.item_code IN ({placeholders})"
    return where


# ============================================================
# KPI CARDS — one round trip, all sums done in SQL (GROUP BY
# where a per-document aggregate is needed before the outer SUM).
# ============================================================
@frappe.whitelist()
def get_dashboard_kpis(filters=None):
    filters = parse_filters(filters)

    # --- Purchase Order: count + grand total -------------------------------
    po_where, po_values = build_conditions(filters, "po", "transaction_date", "poi_x", "Purchase Order Item")
    po_row = frappe.db.sql(f"""
        SELECT COUNT(*) as total_count, IFNULL(SUM(po.grand_total), 0) as total_po_amount
        FROM `tabPurchase Order` po
        WHERE {po_where}
    """, po_values, as_dict=1)[0]

    # --- Purchase Order Item level: qty / received / pending ---------------
    qty_where, qty_values = build_conditions(filters, "po", "transaction_date")
    qty_where = apply_direct_item_filter(filters, qty_where, qty_values)
    qty_row = frappe.db.sql(f"""
        SELECT
            IFNULL(SUM(poi.qty), 0) as total_qty,
            IFNULL(SUM(poi.received_qty), 0) as total_received_qty,
            IFNULL(SUM(poi.qty - poi.received_qty), 0) as total_pending_qty
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {qty_where}
    """, qty_values, as_dict=1)[0]

    # --- Purchase Receipt grand total ---------------------------------------
    pr_where, pr_values = build_conditions(filters, "pr", "posting_date", "pri_x", "Purchase Receipt Item")
    pr_row = frappe.db.sql(f"""
        SELECT IFNULL(SUM(pr.grand_total), 0) as total_pr_amount
        FROM `tabPurchase Receipt` pr
        WHERE {pr_where}
    """, pr_values, as_dict=1)[0]

    # --- Purchase Invoice grand total ---------------------------------------
    pi_where, pi_values = build_conditions(filters, "pi", "posting_date", "pii_x", "Purchase Invoice Item")
    pi_row = frappe.db.sql(f"""
        SELECT IFNULL(SUM(pi.grand_total), 0) as total_pi_amount
        FROM `tabPurchase Invoice` pi
        WHERE {pi_where}
    """, pi_values, as_dict=1)[0]

    # --- Balance to pay: GROUP BY po.name first, then SUM the group --------
    bal_where, bal_values = build_conditions(filters, "po", "transaction_date", "poi_x", "Purchase Order Item")
    bal_row = frappe.db.sql(f"""
        SELECT IFNULL(SUM(t.balance_to_pay), 0) as total_balance_to_pay FROM (
            SELECT po.name,
                (po.grand_total - IFNULL(SUM(DISTINCT pii.base_net_amount), 0)) as balance_to_pay
            FROM `tabPurchase Order` po
            LEFT JOIN `tabPurchase Invoice Item` pii ON pii.purchase_order = po.name
            LEFT JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus = 1
            WHERE {bal_where}
            GROUP BY po.name, po.grand_total
        ) t
        WHERE t.balance_to_pay > 0
    """, bal_values, as_dict=1)[0]

    return {
        "total_count": po_row.total_count,
        "total_qty": qty_row.total_qty,
        "total_po_amount": po_row.total_po_amount,
        "total_pr_amount": pr_row.total_pr_amount,
        "total_pi_amount": pi_row.total_pi_amount,
        "total_received_qty": qty_row.total_received_qty,
        "total_pending_qty": qty_row.total_pending_qty,
        "total_balance_to_pay": bal_row.total_balance_to_pay,
    }


# ============================================================
# CHART DATA — grouped in SQL (GROUP BY item_code / status),
# no client-side map-building needed anymore.
# ============================================================
@frappe.whitelist()
def get_pending_items_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)

    return frappe.db.sql(f"""
        SELECT poi.item_code, SUM(poi.qty - poi.received_qty) as pending_qty
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where} AND (poi.qty - poi.received_qty) > 0
        GROUP BY poi.item_code
        ORDER BY pending_qty DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_balance_to_pay_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)

    # Each PO's outstanding balance is split evenly across its distinct items,
    # then rolled up by item_code — computed entirely in SQL via GROUP BY.
    return frappe.db.sql(f"""
        SELECT t.item_code, SUM(t.balance_share) as balance_to_pay FROM (
            SELECT po.name, poi.item_code,
                (po.grand_total - IFNULL(SUM(DISTINCT pii.base_net_amount), 0)) /
                    (SELECT COUNT(DISTINCT poi2.item_code) FROM `tabPurchase Order Item` poi2 WHERE poi2.parent = po.name)
                    as balance_share
            FROM `tabPurchase Order` po
            INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
            LEFT JOIN `tabPurchase Invoice Item` pii ON pii.purchase_order = po.name
            LEFT JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus = 1
            WHERE {where}
            GROUP BY po.name, poi.item_code
        ) t
        GROUP BY t.item_code
        HAVING balance_to_pay > 0
        ORDER BY balance_to_pay DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_receipt_status_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)

    return frappe.db.sql(f"""
        SELECT
            CASE
                WHEN poi.received_qty = 0 THEN 'Not Received'
                WHEN poi.received_qty >= poi.qty THEN 'Fully Received'
                ELSE 'Partially Received'
            END as status,
            COUNT(*) as count
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where}
        GROUP BY status
    """, values, as_dict=1)


@frappe.whitelist()
def get_invoice_status_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)

    return frappe.db.sql(f"""
        SELECT
            CASE
                WHEN poi.billed_amt = 0 THEN 'Not Billed'
                WHEN poi.billed_amt >= poi.amount THEN 'Fully Billed'
                ELSE 'Partially Billed'
            END as status,
            COUNT(*) as count
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where}
        GROUP BY status
    """, values, as_dict=1)


# ============================================================
# ROW-LEVEL DATA — feeds the drilldown dialog tables.
# ============================================================
@frappe.whitelist()
def get_purchase_orders_sql(filters=None):
    """Drilldown source for the Total Count and PO Grand Amount KPI cards."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date", "poi_x", "Purchase Order Item")
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date, po.grand_total as ordered_amount,
               (SELECT SUM(qty) FROM `tabPurchase Order Item` WHERE parent = po.name) as ordered_qty
        FROM `tabPurchase Order` po
        WHERE {where}
        ORDER BY po.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_purchase_receipts_sql(filters=None):
    """Drilldown source for the Purchase Receipt Grand Amount KPI card."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "pr", "posting_date", "pri_x", "Purchase Receipt Item")
    return frappe.db.sql(f"""
        SELECT 
            pr.name as purchase_order, 
            pr.posting_date as transaction_date, 
            pr.grand_total as ordered_amount,
            GROUP_CONCAT(DISTINCT pri.item_code SEPARATOR ', ') as items
        FROM `tabPurchase Receipt` pr
        LEFT JOIN `tabPurchase Receipt Item` pri ON pri.parent = pr.name
        WHERE {where}
        GROUP BY pr.name, pr.posting_date, pr.grand_total
        ORDER BY pr.posting_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_purchase_invoices_sql(filters=None):
    """Drilldown source for the Purchase Invoice Grand Amount KPI card."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "pi", "posting_date", "pii_x", "Purchase Invoice Item")
    return frappe.db.sql(f"""
        SELECT 
            pi.name as purchase_order, 
            pi.posting_date as transaction_date, 
            pi.grand_total as ordered_amount,
            GROUP_CONCAT(DISTINCT pii.item_code SEPARATOR ', ') as items
        FROM `tabPurchase Invoice` pi
        LEFT JOIN `tabPurchase Invoice Item` pii ON pii.parent = pi.name
        WHERE {where}
        GROUP BY pi.name, pi.posting_date, pi.grand_total
        ORDER BY pi.posting_date DESC
    """, values, as_dict=1)

@frappe.whitelist()
def get_pending_items_sql(filters=None):
    """Drilldown source when a bar on the Pending Qty chart is clicked."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date, poi.item_code,
               (poi.qty - poi.received_qty) as pending_qty
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where} AND (poi.qty - poi.received_qty) > 0
        ORDER BY po.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_balance_to_pay_sql(filters=None):
    """Drilldown source when a bar on the Balance to Pay chart is clicked."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date,
               GROUP_CONCAT(DISTINCT poi.item_code) as items,
               (po.grand_total - IFNULL(SUM(DISTINCT pii.base_net_amount), 0)) as balance_to_pay
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        LEFT JOIN `tabPurchase Invoice Item` pii ON pii.purchase_order = po.name
        LEFT JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus = 1
        WHERE {where}
        GROUP BY po.name, po.transaction_date, po.grand_total
        HAVING balance_to_pay > 0
        ORDER BY po.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_po_receipt_status_sql(filters=None):
    """Drilldown source when a slice of the Receipt Status donut is clicked."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date, poi.item_code, poi.qty,
            CASE
                WHEN poi.received_qty = 0 THEN 'Not Received'
                WHEN poi.received_qty >= poi.qty THEN 'Fully Received'
                ELSE 'Partially Received'
            END as receipt_status
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where}
        ORDER BY po.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_po_invoice_status_sql(filters=None):
    """Drilldown source when a slice of the Billing Status donut is clicked."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_filter(filters, where, values)
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date, poi.item_code, poi.qty,
            CASE
                WHEN poi.billed_amt = 0 THEN 'Not Billed'
                WHEN poi.billed_amt >= poi.amount THEN 'Fully Billed'
                ELSE 'Partially Billed'
            END as invoice_status
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where}
        ORDER BY po.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_sum():
    """Generates financial volumes for the global Procurement Funnel block (unfiltered)."""
    return {
        "purchase_order": frappe.db.get_value("Purchase Order", {"docstatus": 1}, "sum(grand_total)") or 0,
        "purchase_receipt": frappe.db.get_value("Purchase Receipt", {"docstatus": 1}, "sum(grand_total)") or 0,
        "purchase_invoice": frappe.db.get_value("Purchase Invoice", {"docstatus": 1}, "sum(grand_total)") or 0,
        "payment_entry": frappe.db.get_value("Payment Entry", {"docstatus": 1, "payment_type": "Pay"}, "sum(paid_amount)") or 0,
    }