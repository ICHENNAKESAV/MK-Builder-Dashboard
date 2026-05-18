import frappe

"""How much inventory cost was consumed/sold for each item group during a date range?"""
@frappe.whitelist()
def get_cogs_data(from_date=None, to_date=None, company=None):

    if not company:
        company = frappe.defaults.get_user_default("Company")

    data = frappe.db.sql("""
        SELECT
            i.item_group,
            ROUND(SUM(sle.stock_value_difference) * -1, 2) AS cogs
        FROM
            `tabStock Ledger Entry` sle
        INNER JOIN
            `tabItem` i
                ON i.name = sle.item_code
        WHERE
            sle.is_cancelled = 0
            AND sle.company = %(company)s
            AND sle.posting_date BETWEEN %(from_date)s AND %(to_date)s
        GROUP BY
            i.item_group
        ORDER BY
            cogs DESC
    """, {
        "from_date": from_date,
        "to_date": to_date,
        "company": company
    }, as_dict=True)

    return data