import frappe

@frappe.whitelist()
def get_rmc_variance_report(from_date=None, to_date=None, warehouse=None, rmc_grade=None):
    
    conditions = []
    values = {}

    # 🔹 Conditional filters
    if from_date and to_date:
        conditions.append("posting_date BETWEEN %(from_date)s AND %(to_date)s")
        values["from_date"] = from_date
        values["to_date"] = to_date

    if warehouse:
        conditions.append("destination_warehouse = %(warehouse)s")
        values["warehouse"] = warehouse

    if rmc_grade:
        conditions.append("rmc_grade = %(rmc_grade)s")
        values["rmc_grade"] = rmc_grade

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT
            posting_date,
            rmc_grade,
            destination_warehouse,
            item_code,
            uom,
            rate,

            SUM(estimated_qty) AS `Estimated Quantity`,
            SUM(actual_qty) AS `Actual Quantity`,
            SUM(actual_qty) - SUM(estimated_qty) AS `Difference`,

            CASE
                WHEN SUM(estimated_qty) > 0
                THEN ROUND(
                    (SUM(actual_qty) - SUM(estimated_qty)) 
                    / SUM(estimated_qty) * 100, 2
                )
                ELSE 0
            END AS `Variance Percent`,

            SUM(estimated_qty * rate) AS `Estimated Cost`,
            SUM(actual_qty * rate) AS `Actual Cost`,
            SUM(actual_qty * rate) - SUM(estimated_qty * rate) AS `Cost Difference`

        FROM (

            SELECT
                parent.production_date AS posting_date,
                parent.rmc_grade,
                parent.destination_warehouse,
                child.item_code,
                child.uom,
                child.rate,
                child.estimated_qty,
                child.qty AS actual_qty
            FROM `tabRMC Production Entry` parent
            JOIN `tabRMC Raw Materials` child
                ON child.parent = parent.name

            UNION ALL

            SELECT
                parent.date AS posting_date,
                parent.item_to_manufacture AS rmc_grade,
                parent.target_warehouse AS destination_warehouse,
                child.item AS item_code,
                child.uom,
                child.rate,
                child.required_qty AS estimated_qty,
                child.actual_qty
            FROM `tabRMC Production` parent
            JOIN `tabrmc item table` child
                ON child.parent = parent.name

        ) AS combined_data
        {where_clause}

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

@frappe.whitelist()
def get_rmc_grades():
    return frappe.db.sql("""
        SELECT DISTINCT rmc_grade
        FROM `tabRMC Production Entry`
        WHERE rmc_grade IS NOT NULL
        ORDER BY rmc_grade
    """, as_dict=True)