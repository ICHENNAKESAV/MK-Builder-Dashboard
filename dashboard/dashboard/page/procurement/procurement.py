import frappe
import json
from frappe import _
from frappe.utils import flt

@frappe.whitelist()
def get_purchase_orders_sql(filters=None):
    """Fetches base data for Purchase Orders and Summary metrics."""
    filters = parse_filters(filters)
    values = {}
    
    query = """
        SELECT 
            po.name as purchase_order,
            po.transaction_date,
            po.grand_total as ordered_amount,
            SUM(poi.qty) as ordered_qty
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE po.docstatus = 1
    """
    
    query, values = apply_standard_filters(query, values, filters, "po", "poi")
    query += " GROUP BY po.name, po.transaction_date, po.grand_total"
    
    return frappe.db.sql(query, values, as_dict=1)


@frappe.whitelist()
def get_po_item_status(filters=None):
    """Calculates cumulative received metrics."""
    filters = parse_filters(filters)
    values = {}
    
    query = """
        SELECT 
            po.name as purchase_order,
            po.transaction_date,
            poi.item_code,
            poi.received_qty
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE po.docstatus = 1
    """
    
    query, values = apply_standard_filters(query, values, filters, "po", "poi")
    return frappe.db.sql(query, values, as_dict=1)


@frappe.whitelist()
def get_pending_items_sql(filters=None):
    """Tracks quantities outstanding for delivery per item and PO."""
    filters = parse_filters(filters)
    values = {}
    
    query = """
        SELECT 
            po.name as purchase_order,
            po.transaction_date,
            poi.item_code,
            (poi.qty - poi.received_qty) as pending_qty
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE po.docstatus = 1 AND (poi.qty - poi.received_qty) > 0
    """
    
    query, values = apply_standard_filters(query, values, filters, "po", "poi")
    return frappe.db.sql(query, values, as_dict=1)


@frappe.whitelist()
def get_invoice_payments_sql(filters=None):
    """Tracks historical paid ledger entries and links them to items safely via pii."""
    filters = parse_filters(filters)
    values = {}
    
    query = """
        SELECT 
            pi.name as purchase_order, 
            pi.posting_date as transaction_date,
            GROUP_CONCAT(DISTINCT pii.item_code) as items,
            SUM(DISTINCT per.allocated_amount) as paid_amount
        FROM `tabPurchase Invoice` pi
        INNER JOIN `tabPurchase Invoice Item` pii ON pii.parent = pi.name
        INNER JOIN `tabPayment Entry Reference` per ON per.reference_name = pi.name
        WHERE pi.docstatus = 1
    """
    
    query, values = apply_standard_filters(query, values, filters, "pi", "pii")
    query += " GROUP BY pi.name, pi.posting_date"
    
    return frappe.db.sql(query, values, as_dict=1)


@frappe.whitelist()
def get_balance_to_pay_sql(filters=None):
    """Calculates remaining payable amount against Purchase Orders safely."""
    filters = parse_filters(filters)
    values = {}

    # FIXED: Added the missing closing backtick to `tabPurchase Invoice`
    query = """
        SELECT 
            po.name as purchase_order,
            po.transaction_date,
            GROUP_CONCAT(DISTINCT poi.item_code) as items,
            (po.grand_total - IFNULL(SUM(pii.base_net_amount), 0)) as balance_to_pay
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        LEFT JOIN `tabPurchase Invoice Item` pii ON pii.purchase_order = po.name
        LEFT JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus = 1
        WHERE po.docstatus = 1
    """

    query, values = apply_standard_filters(query, values, filters, "po", "poi")
    
    query += """
        GROUP BY 
            po.name,
            po.transaction_date,
            po.grand_total
        HAVING balance_to_pay > 0
    """

    return frappe.db.sql(query, values, as_dict=1)


@frappe.whitelist()
def get_po_receipt_status_sql(filters=None):
    """Calculates full, partial, or unreceived item lines status."""
    filters = parse_filters(filters)
    values = {}
    
    query = """
        SELECT 
            po.name as purchase_order,
            po.transaction_date,
            poi.item_code,
            poi.qty,
            CASE 
                WHEN poi.received_qty = 0 THEN 'Not Received'
                WHEN poi.received_qty >= poi.qty THEN 'Fully Received'
                ELSE 'Partially Received'
            END as receipt_status
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE po.docstatus = 1
    """
    
    query, values = apply_standard_filters(query, values, filters, "po", "poi")
    return frappe.db.sql(query, values, as_dict=1)


@frappe.whitelist()
def get_po_invoice_status_sql(filters=None):
    """Calculates billing configurations categorization data."""
    filters = parse_filters(filters)
    values = {}
    
    query = """
        SELECT 
            po.name as purchase_order,
            po.transaction_date,
            poi.item_code,
            poi.qty,
            CASE 
                WHEN poi.billed_amt = 0 THEN 'Not Billed'
                WHEN poi.billed_amt >= poi.amount THEN 'Fully Billed'
                ELSE 'Partially Billed'
            END as invoice_status
        FROM `tabPurchase Order` po
        INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE po.docstatus = 1
    """
    
    query, values = apply_standard_filters(query, values, filters, "po", "poi")
    return frappe.db.sql(query, values, as_dict=1)


@frappe.whitelist()
def get_sum():
    """Generates financial volumes for the global Procurement Funnel block."""
    totals = {
        "purchase_order": frappe.db.get_value("Purchase Order", {"docstatus": 1}, "sum(grand_total)") or 0,
        "purchase_receipt": frappe.db.get_value("Purchase Receipt", {"docstatus": 1}, "sum(grand_total)") or 0,
        "purchase_invoice": frappe.db.get_value("Purchase Invoice", {"docstatus": 1}, "sum(grand_total)") or 0,
        "payment_entry": frappe.db.get_value("Payment Entry", {"docstatus": 1, "payment_type": "Pay"}, "sum(paid_amount)") or 0
    }
    return totals


# --- REUSABLE UTILITY HELPER METHODS ---

def parse_filters(filters):
    """Safely extracts JSON payloads from client request vectors."""
    if isinstance(filters, str):
        try:
            return json.loads(filters)
        except ValueError:
            return {}
    return filters or {}


def apply_standard_filters(query, values, filters, parent_alias, child_alias):
    """Dynamically applies UI parameters using consistent table aliases."""
    date_col = "posting_date" if parent_alias == "pi" else "transaction_date"
    
    if filters.get("company"):
        query += f" AND {parent_alias}.company = %(company)s"
        values["company"] = filters.get("company")
        
    if filters.get("supplier"):
        query += f" AND {parent_alias}.supplier = %(supplier)s"
        values["supplier"] = filters.get("supplier")

    if filters.get("project"):
        query += f" AND {parent_alias}.project = %(project)s"
        values["project"] = filters.get("project")

    if filters.get("from_date"):
        query += f" AND {parent_alias}.{date_col} >= %(from_date)s"
        values["from_date"] = filters.get("from_date")

    if filters.get("to_date"):
        query += f" AND {parent_alias}.{date_col} <= %(to_date)s"
        values["to_date"] = filters.get("to_date")

    if filters.get("item_code"):
        query += f" AND {child_alias}.item_code = %(item_code)s"
        values["item_code"] = filters.get("item_code")

    return query, values