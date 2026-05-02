import frappe

@frappe.whitelist()
def get_rmc_variance_report(from_date=None, to_date=None, warehouse=None, rmc_grade=None):

    values = {}

    where1 = []
    where2 = []

    # ---------------- FILTERS ----------------
    if from_date and to_date:
        where1.append("parent.production_date BETWEEN %(from_date)s AND %(to_date)s")
        where2.append("parent.date BETWEEN %(from_date)s AND %(to_date)s")
        values["from_date"] = from_date
        values["to_date"] = to_date

    if warehouse:
        where1.append("parent.destination_warehouse = %(warehouse)s")
        where2.append("parent.target_warehouse = %(warehouse)s")
        values["warehouse"] = warehouse

    if rmc_grade:
        where1.append("parent.rmc_grade = %(rmc_grade)s")
        where2.append("parent.item_to_manufacture = %(rmc_grade)s")
        values["rmc_grade"] = rmc_grade

    where_clause_1 = " AND ".join(where1)
    where_clause_2 = " AND ".join(where2)

    query = f"""
    SELECT
        posting_date,
        rmc_grade,
        destination_warehouse,
        item_code,
        uom,
        rate,

        ROUND(SUM(estimated_qty), 2) AS `Estimated Quantity`,
        ROUND(SUM(actual_qty), 2) AS `Actual Quantity`,
        ROUND(SUM(actual_qty) - SUM(estimated_qty), 2) AS `Difference`,

        CASE
            WHEN SUM(estimated_qty) > 0
            THEN ROUND(
                (SUM(actual_qty) - SUM(estimated_qty)) 
                / SUM(estimated_qty) * 100, 2
            )
            ELSE 0
        END AS `Variance Percent`,

        ROUND(SUM(estimated_qty * rate), 2) AS `Estimated Cost`,
        ROUND(SUM(actual_qty * rate), 2) AS `Actual Cost`,
        ROUND(SUM(actual_qty * rate) - SUM(estimated_qty * rate), 2) AS `Cost Difference`

    FROM (

        SELECT
            parent.production_date AS posting_date,
            parent.rmc_grade AS rmc_grade,
            parent.destination_warehouse AS destination_warehouse,
            child.item_code,
            child.uom,
            child.rate,
            child.estimated_qty,
            child.qty AS actual_qty
        FROM `tabRMC Production Entry` parent
        JOIN `tabRMC Raw Materials` child
            ON child.parent = parent.name
        {"WHERE " + where_clause_1 if where_clause_1 else ""}

        UNION ALL

        SELECT
            parent.date AS posting_date,
            parent.item_to_manufacture AS rmc_grade,
            parent.target_warehouse AS destination_warehouse,
            child.item AS item_code,
            child.uom,
            child.rate,
            child.required_qty AS estimated_qty,
            child.actual_qty AS actual_qty
        FROM `tabRMC Production` parent
        JOIN `tabrmc item table` child
            ON child.parent = parent.name
        {"WHERE " + where_clause_2 if where_clause_2 else ""}

    ) AS combined_data

    GROUP BY
        posting_date,
        rmc_grade,
        destination_warehouse,
        item_code,
        uom,
        rate

    ORDER BY
        posting_date,
        item_code
    """

    return frappe.db.sql(query, values, as_dict=True)


# ---------------- GRADES ----------------
@frappe.whitelist()
def get_rmc_grades():
    return frappe.db.sql("""
        SELECT DISTINCT rmc_grade
        FROM `tabRMC Production Entry`
        WHERE rmc_grade IS NOT NULL
        ORDER BY rmc_grade
    """, as_dict=True)