import frappe

@frappe.whitelist()
def get_rmc_production_summary(from_date=None, to_date=None, rmc_grade=None, destination_warehouse=None):

    # -------------------------------------------------------
    # Build WHERE clauses separately for old & new flow tables
    # because column names differ between the two doctypes.
    # -------------------------------------------------------
    conditions_old = "WHERE docstatus = 1"
    conditions_new = "WHERE docstatus = 1"

    if from_date and to_date:
        conditions_old += " AND production_date BETWEEN %(from_date)s AND %(to_date)s"
        conditions_new += " AND `date` BETWEEN %(from_date)s AND %(to_date)s"
    elif from_date:
        conditions_old += " AND production_date >= %(from_date)s"
        conditions_new += " AND `date` >= %(from_date)s"
    elif to_date:
        conditions_old += " AND production_date <= %(to_date)s"
        conditions_new += " AND `date` <= %(to_date)s"

    # BUG FIX: old flow uses `rmc_grade`, new flow uses `item_to_manufacture`
    if rmc_grade:
        conditions_old += " AND rmc_grade = %(rmc_grade)s"
        conditions_new += " AND item_to_manufacture = %(rmc_grade)s"

    # BUG FIX: old flow uses `destination_warehouse`, new uses `target_warehouse`
    if destination_warehouse:
        conditions_old += " AND destination_warehouse = %(destination_warehouse)s"
        conditions_new += " AND target_warehouse = %(destination_warehouse)s"

    query = f"""
        SELECT
            production_date          AS `Date`,
            rmc_grade                AS `RMC Grade`,
            destination_warehouse    AS `Destination Warehouse`,
            SUM(quantity)            AS `Total Quantity`,

            -- BUG FIX: weighted average mixing rate, not plain AVG of pre-grouped rows
            ROUND(
                SUM(mixing_rate * quantity) / NULLIF(SUM(quantity), 0),
            2)                       AS `Mixing Rate`,

            ROUND(SUM(total_mixing_cost), 2)          AS `Total Mixing Cost`,
            ROUND(SUM(total_raw_material_cost), 2)    AS `Total Raw Material Cost`,
            ROUND(
                SUM(total_mixing_cost) + SUM(total_raw_material_cost),
            2)                       AS `Total Production Cost`

        FROM (

            -- OLD FLOW (tabRMC Production Entry)
            SELECT
                production_date,
                rmc_grade,
                destination_warehouse,
                quantity,
                mixing_rate,
                total_mixing_cost,
                total_raw_material_cost
            FROM `tabRMC Production Entry`
            {conditions_old}

            UNION ALL

            -- NEW FLOW (tabRMC Production)
            SELECT
                `date`              AS production_date,
                item_to_manufacture AS rmc_grade,
                target_warehouse    AS destination_warehouse,
                qty_to_manufacture  AS quantity,
                mixing_rate,
                total_mixing_cost,
                total_raw_material_cost
            FROM `tabRMC Production`
            {conditions_new}

        ) AS combined_data

        GROUP BY
            production_date,
            rmc_grade,
            destination_warehouse

        ORDER BY
            production_date,
            rmc_grade,
            destination_warehouse
    """

    return frappe.db.sql(query, {
        "from_date": from_date,
        "to_date": to_date,
        "rmc_grade": rmc_grade,
        "destination_warehouse": destination_warehouse
    }, as_dict=True)