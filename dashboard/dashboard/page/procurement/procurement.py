import frappe
import json
from frappe.utils import flt


# ============================================================
# FILTER OPTIONS — powers the pure-JS filter bar on the client.
# Only returns values that actually occur in submitted documents,
# instead of the entire Company/Supplier/Item Group/Project doctype.
#
# ★ CHANGE: item-level filter replaced with item_group filter.
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

    # ★ item_group instead of item_code
    item_groups = frappe.db.sql("""
        SELECT DISTINCT poi.item_group
        FROM `tabPurchase Order Item` poi
        INNER JOIN `tabPurchase Order` po ON po.name = poi.parent
        WHERE po.docstatus = 1 AND poi.item_group IS NOT NULL AND poi.item_group != ''
        ORDER BY poi.item_group
    """, as_dict=1)

    return {
        "companies": [r.company for r in companies],
        "suppliers": [r.supplier for r in suppliers],
        "projects": [r.project for r in projects],
        "item_groups": [r.item_group for r in item_groups],
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
    item_alias / item_table : if given and item_group(s) are selected, an EXISTS
                 subquery against that child table is added (so item-group filtering
                 never duplicates parent rows).

    ★ CHANGE: filters by item_group instead of item_code.
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

    item_group_items = _as_list(filters.get("item_group"))
    if item_group_items and item_alias and item_table:
        placeholders = _in_clause(values, "item_group", item_group_items)
        conditions.append(f"""EXISTS (
            SELECT 1 FROM `tab{item_table}` {item_alias}
            WHERE {item_alias}.parent = {alias}.name AND {item_alias}.item_group IN ({placeholders})
        )""")

    return " AND ".join(conditions), values


def apply_direct_item_group_filter(filters, where, values, item_alias="poi"):
    """For queries already joined directly to a *Item child table, adds an
    IN clause against that alias's item_group (used instead of build_conditions'
    EXISTS subquery when the item table is already part of the FROM/JOIN)."""
    item_group_items = _as_list(filters.get("item_group"))
    if item_group_items:
        placeholders = _in_clause(values, "item_group", item_group_items)
        where += f" AND {item_alias}.item_group IN ({placeholders})"
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
    qty_where = apply_direct_item_group_filter(filters, qty_where, qty_values)
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

    # --- Balance to pay -------------------------------------------------
    # ★ BUG FIX: previously used `SUM(DISTINCT pii.base_net_amount)` after a
    # LEFT JOIN, which silently collapses genuinely different invoice lines
    # that happen to share the same amount (e.g. two ₹500 lines counted as
    # one). That under-billed figure inflated "balance to pay" so it never
    # matched the real per-row totals shown in the drilldown table.
    # Replaced with a correlated subquery that sums billed amounts per PO
    # directly — no DISTINCT, no collapsing, no duplicate-row risk.
    bal_where, bal_values = build_conditions(filters, "po", "transaction_date", "poi_x", "Purchase Order Item")
    bal_row = frappe.db.sql(f"""
        SELECT IFNULL(SUM(t.balance_to_pay), 0) as total_balance_to_pay FROM (
            SELECT po.name,
                (po.grand_total - IFNULL((
                    SELECT SUM(pii.base_net_amount)
                    FROM `tabPurchase Invoice Item` pii
                    INNER JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus = 1
                    WHERE pii.purchase_order = po.name
                ), 0)) as balance_to_pay
            FROM `tabPurchase Order` po
            WHERE {bal_where}
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
# CHART DATA — grouped in SQL (GROUP BY item_group / status),
# no client-side map-building needed anymore.
# ★ CHANGE: bars are grouped by item_group instead of item_code.
# ============================================================
@frappe.whitelist()
def get_pending_items_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)

    return frappe.db.sql(f"""
        SELECT poi.item_group, SUM(poi.qty - poi.received_qty) as pending_qty
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where} AND (poi.qty - poi.received_qty) > 0
        GROUP BY poi.item_group
        ORDER BY pending_qty DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_balance_to_pay_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)

    # ★ BUG FIX: same SUM(DISTINCT) collapsing issue as above, fixed the same
    # way — billed amount per PO is now a correlated subquery, computed once
    # per PO (not once per item-group row), then split evenly across the
    # distinct item groups on that PO.
    return frappe.db.sql(f"""
        SELECT t.item_group, SUM(t.balance_share) as balance_to_pay FROM (
            SELECT po.name, poi.item_group,
                (po.grand_total - IFNULL((
                    SELECT SUM(pii.base_net_amount)
                    FROM `tabPurchase Invoice Item` pii
                    INNER JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus = 1
                    WHERE pii.purchase_order = po.name
                ), 0)) /
                    (SELECT COUNT(DISTINCT poi2.item_group) FROM `tabPurchase Order Item` poi2 WHERE poi2.parent = po.name)
                    as balance_share
            FROM `tabPurchase Order` po
            INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
            WHERE {where}
            GROUP BY po.name, poi.item_group
        ) t
        GROUP BY t.item_group
        HAVING balance_to_pay > 0
        ORDER BY balance_to_pay DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_receipt_status_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)

    # ★ BUG FIX: `Purchase Order` has a real column literally named `status`
    # (Draft / To Bill / To Receive / Completed / Closed / etc). MySQL's
    # column-resolution rule for GROUP BY prefers a real column from the
    # FROM-clause tables over a SELECT alias of the same name — so
    # `GROUP BY status` was silently grouping by the real workflow status
    # column instead of the CASE label below, splitting each label into
    # several rows (one per real status that happens to map to it) and
    # scattering the count across them. Grouping on the CASE expression
    # itself removes the ambiguity entirely.
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
        GROUP BY CASE
            WHEN poi.received_qty = 0 THEN 'Not Received'
            WHEN poi.received_qty >= poi.qty THEN 'Fully Received'
            ELSE 'Partially Received'
        END
    """, values, as_dict=1)


@frappe.whitelist()
def get_invoice_status_grouped(filters=None):
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)

    # ★ Same GROUP BY ambiguity fix as get_receipt_status_grouped.
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
        GROUP BY CASE
            WHEN poi.billed_amt = 0 THEN 'Not Billed'
            WHEN poi.billed_amt >= poi.amount THEN 'Fully Billed'
            ELSE 'Partially Billed'
        END
    """, values, as_dict=1)


# ============================================================
# ROW-LEVEL DATA — feeds the drilldown dialog tables.
# These stay at item_code granularity (the actual PO/PR/PI lines),
# even though the bar/donut charts above now group by item_group —
# the drilldown is meant to show the real underlying line items.
# ============================================================
@frappe.whitelist()
def get_purchase_orders_sql(filters=None):
    """Drilldown source for the Total Count and PO Grand Amount KPI cards."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date", "poi_x", "Purchase Order Item")
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date, po.grand_total as ordered_amount,
               (SELECT SUM(qty) FROM `tabPurchase Order Item` WHERE parent = po.name) as ordered_qty,
               (SELECT GROUP_CONCAT(DISTINCT item_code SEPARATOR ', ') FROM `tabPurchase Order Item` WHERE parent = po.name) as items
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


# ============================================================
# ITEM-LEVEL PO DRILLDOWN — powers the "Total Count" and
# "PO Grand Amount" KPI card drilldowns.
# Returns one row per Purchase Order Item so the dialog can
# show actual line items with both Qty and Amount columns.
# ============================================================
@frappe.whitelist()
def get_purchase_order_items_sql(filters=None):
    """Drilldown source for the Total Count and PO Grand Amount KPI cards.

    Unlike get_purchase_orders_sql (which returns one row per PO document),
    this returns one row per PO line item — giving the user visibility into
    what items were ordered and at what qty / amount.
    """
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)

    return frappe.db.sql(f"""
        SELECT
            po.name            AS purchase_order,
            po.transaction_date,
            poi.item_code,
            poi.item_name,
            poi.item_group,
            poi.qty,
            poi.rate,
            poi.amount
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where}
        ORDER BY po.transaction_date DESC, po.name, poi.idx
    """, values, as_dict=1)


@frappe.whitelist()
def get_pending_items_sql(filters=None):

    """Drilldown source when a bar on the Pending Qty chart is clicked.
    filters['item_group'] will contain the clicked group; returns the
    individual item_code lines that make it up."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date, poi.item_code, poi.item_group,
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
    where = apply_direct_item_group_filter(filters, where, values)
    # ★ Same SUM(DISTINCT) bug fixed here too — correlated subquery instead.
    return frappe.db.sql(f"""
        SELECT po.name as purchase_order, po.transaction_date,
               GROUP_CONCAT(DISTINCT poi.item_code) as items,
               (po.grand_total - IFNULL((
                   SELECT SUM(pii.base_net_amount)
                   FROM `tabPurchase Invoice Item` pii
                   INNER JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus = 1
                   WHERE pii.purchase_order = po.name
               ), 0)) as balance_to_pay
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE {where}
        GROUP BY po.name, po.transaction_date, po.grand_total
        HAVING balance_to_pay > 0
        ORDER BY po.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_po_receipt_status_sql(filters=None, status=None):
    """Drilldown source when a slice of the Receipt Status donut is clicked.

    ★ BUG FIX: `status` is now filtered *inside* SQL (via the wrapping
    HAVING clause below) instead of being fetched unfiltered and matched
    client-side with `records.filter(...)`. Two separate computations
    (one in SQL for the pie count, one in JS for the drilldown) can
    drift apart — e.g. if filters change between the donut rendering
    and the click. Filtering the status in the same SQL statement that
    computes it removes that possibility: the row count returned is
    guaranteed to equal the pie slice's count for the same filters.
    """
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)

    status_filter = ""
    if status:
        status_filter = "WHERE t.receipt_status = %(status)s"
        values["status"] = status

    return frappe.db.sql(f"""
        SELECT * FROM (
            SELECT po.name as purchase_order, po.transaction_date, poi.item_code, poi.item_group, poi.qty,
                CASE
                    WHEN poi.received_qty = 0 THEN 'Not Received'
                    WHEN poi.received_qty >= poi.qty THEN 'Fully Received'
                    ELSE 'Partially Received'
                END as receipt_status
            FROM `tabPurchase Order` po
            INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
            WHERE {where}
        ) t
        {status_filter}
        ORDER BY t.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_po_invoice_status_sql(filters=None, status=None):
    """Drilldown source when a slice of the Billing Status donut is clicked.
    ★ Same server-side status filtering fix as get_po_receipt_status_sql."""
    filters = parse_filters(filters)
    where, values = build_conditions(filters, "po", "transaction_date")
    where = apply_direct_item_group_filter(filters, where, values)

    status_filter = ""
    if status:
        status_filter = "WHERE t.invoice_status = %(status)s"
        values["status"] = status

    return frappe.db.sql(f"""
        SELECT * FROM (
            SELECT po.name as purchase_order, po.transaction_date, poi.item_code, poi.item_group, poi.qty,
                CASE
                    WHEN poi.billed_amt = 0 THEN 'Not Billed'
                    WHEN poi.billed_amt >= poi.amount THEN 'Fully Billed'
                    ELSE 'Partially Billed'
                END as invoice_status
            FROM `tabPurchase Order` po
            INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
            WHERE {where}
        ) t
        {status_filter}
        ORDER BY t.transaction_date DESC
    """, values, as_dict=1)


@frappe.whitelist()
def get_sum():
    """Generates financial volumes for the global Procurement Funnel block (unfiltered).

    ★ FIX PY-1: frappe.db.get_value does not support raw SQL aggregate expressions
    reliably — it wraps the third arg as a bare column name, not an expression.
    Using frappe.db.sql with IFNULL guarantees a numeric result even on empty tables.
    """
    po = frappe.db.sql(
        "SELECT IFNULL(SUM(grand_total), 0) AS val FROM `tabPurchase Order` WHERE docstatus = 1",
        as_dict=1,
    )
    pr = frappe.db.sql(
        "SELECT IFNULL(SUM(grand_total), 0) AS val FROM `tabPurchase Receipt` WHERE docstatus = 1",
        as_dict=1,
    )
    pi = frappe.db.sql(
        "SELECT IFNULL(SUM(grand_total), 0) AS val FROM `tabPurchase Invoice` WHERE docstatus = 1",
        as_dict=1,
    )
    pe = frappe.db.sql(
        "SELECT IFNULL(SUM(paid_amount), 0) AS val FROM `tabPayment Entry` WHERE docstatus = 1 AND payment_type = 'Pay'",
        as_dict=1,
    )
    return {
        "purchase_order":  po[0].val if po else 0,
        "purchase_receipt": pr[0].val if pr else 0,
        "purchase_invoice": pi[0].val if pi else 0,
        "payment_entry":   pe[0].val if pe else 0,
    }