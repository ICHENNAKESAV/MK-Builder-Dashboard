import frappe

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

# =========================
# 📊 PRODUCTION VS SALES SUMMARY
# =========================
@frappe.whitelist()
def get_production_vs_sales(from_date=None, to_date=None, company=None):

    conditions_prod = []
    conditions_sales = []

    values = {}

    # -------------------------
    # Date Filters
    # -------------------------
    if from_date:
        conditions_prod.append("bp.date >= %(from_date)s")
        conditions_sales.append("dn.posting_date >= %(from_date)s")
        values["from_date"] = from_date

    if to_date:
        conditions_prod.append("bp.date <= %(to_date)s")
        conditions_sales.append("dn.posting_date <= %(to_date)s")
        values["to_date"] = to_date

    # -------------------------
    # Company Filter
    # -------------------------
    if company:
        conditions_prod.append("LOWER(bp.company) = %(company)s")
        conditions_sales.append("LOWER(dn.company) = %(company)s")
        values["company"] = company.lower()

    # -------------------------
    # WHERE CLAUSE
    # -------------------------
    prod_where = ""
    sales_where = ""

    if conditions_prod:
        prod_where = " AND " + " AND ".join(conditions_prod)

    if conditions_sales:
        sales_where = " AND " + " AND ".join(conditions_sales)

    # -------------------------
    # QUERY
    # -------------------------
    query = f"""
        WITH production AS (

            SELECT
                bp.company,
                bp.brick_size AS item_code,

                SUM(bp.produced_bricks) AS total_produced_bricks,

                SUM(bp.total_production_cost) AS total_production_cost

            FROM `tabBrick Production` bp

            WHERE bp.docstatus = 1
            {prod_where}

            GROUP BY bp.company, bp.brick_size
        ),

        sales AS (

            SELECT
                dn.company,
                dni.item_code AS item_code,

                SUM(dni.qty) AS total_sold_qty,

                SUM(dni.amount) AS total_sales_amount

            FROM `tabDelivery Note` dn

            INNER JOIN `tabDelivery Note Item` dni
                ON dni.parent = dn.name

            WHERE dn.docstatus = 1
            {sales_where}

            GROUP BY dn.company, dni.item_code
        )

        SELECT

            COALESCE(p.item_code, s.item_code) AS item,
            COALESCE(p.company, s.company) AS company,

            IFNULL(p.total_produced_bricks, 0) AS produced_bricks,

            IFNULL(p.total_production_cost, 0) AS total_production_cost,

            IFNULL(s.total_sales_amount, 0) AS total_sales_amount,

            (
                IFNULL(s.total_sales_amount, 0)
                -
                IFNULL(p.total_production_cost, 0)
            ) AS balance

        FROM production p

        LEFT JOIN sales s
            ON p.item_code = s.item_code

        ORDER BY item ASC
    """

    return frappe.db.sql(query, values, as_dict=True)