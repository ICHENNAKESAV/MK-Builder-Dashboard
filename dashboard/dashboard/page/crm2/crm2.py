import frappe

@frappe.whitelist()
def get_crm_dashboard_data():

    # -----------------------------------
    # QUERY 1: REQUIREMENTS (Chart 1)
    # -----------------------------------
    requirements_query = """
        SELECT
            parent.custom_block AS Block,
            parent.custom_flat_no AS "Flat No",
            parent.customer_name AS "Customer Name",
            parent.custom_customer_mobile_no AS "Mobile No",
            parent.custom_project AS Project,

            CASE 
                WHEN parent.custom_tiles_required IN ('Yes', 'No') THEN parent.custom_tiles_required
                ELSE ''
            END AS Tiles,

            MAX(CASE 
                WHEN child.category = 'Doors' AND child.required IN ('Yes', 'No') THEN child.required 
                ELSE '' 
            END) AS Doors,

            MAX(CASE 
                WHEN child.category = 'Electrical' AND child.required IN ('Yes', 'No') THEN child.required 
                ELSE '' 
            END) AS Electrical,

            MAX(CASE 
                WHEN child.category = 'Paints' AND child.required IN ('Yes', 'No') THEN child.required 
                ELSE '' 
            END) AS Paints,

            MAX(CASE 
                WHEN child.category = 'CP And Sanitary' AND child.required IN ('Yes', 'No') THEN child.required 
                ELSE '' 
            END) AS "CP And Sanitary",

            MAX(child.status) AS Status

        FROM
            `tabCustomer` AS parent
        LEFT JOIN
            `tabOther Requirements Table CRM` AS child 
            ON parent.name = child.parent

        GROUP BY
            parent.name,
            parent.custom_block,
            parent.custom_flat_no,
            parent.customer_name,
            parent.custom_customer_mobile_no,
            parent.custom_tiles_required

        ORDER BY
            parent.creation DESC
        LIMIT 1000
    """

    requirements_data = frappe.db.sql(requirements_query, as_dict=True)

    # -----------------------------------
    # QUERY 2: CATEGORY vs STATUS (Chart 2)
    # -----------------------------------
    category_status_query = """
        WITH status_data AS (

            -- Tiles logic (ALL must be completed)
            SELECT
                p.name AS customer_id,
                p.customer_name AS customer_name,
                p.custom_block AS block,
                p.custom_flat_no AS flat_no,
                p.custom_project AS project,
                c.category,
                CASE
                    WHEN COUNT(c.name) = SUM(CASE WHEN c.status = 'Completed' THEN 1 ELSE 0 END)
                    THEN 'Completed'
                    ELSE 'Pending'
                END AS status
            FROM
                `tabCustomer` p
            JOIN
                `tabCustomer Requirements Table CRM` c
                ON c.parent = p.name
            WHERE
                c.category = 'Tiles'
            GROUP BY
                p.name, p.customer_name, p.custom_block, p.custom_flat_no, p.custom_project, c.category

            UNION ALL

            -- Other categories (ANY completed = completed)
            SELECT
                p.name AS customer_id,
                p.customer_name AS customer_name,
                p.custom_block AS block,
                p.custom_flat_no AS flat_no,
                p.custom_project AS project,
                o.category,
                CASE
                    WHEN SUM(CASE WHEN o.status = 'Completed' THEN 1 ELSE 0 END) > 0
                    THEN 'Completed'
                    ELSE 'Pending'
                END AS status
            FROM
                `tabCustomer` p
            JOIN
                `tabOther Requirements Table CRM` o
                ON o.parent = p.name
            WHERE
                o.category IN ('Paints','CP And Sanitary','Electrical','Doors')
            GROUP BY
                p.name, p.customer_name, p.custom_block, p.custom_flat_no, p.custom_project, o.category
        )

        SELECT
            category,
            status,
            customer_name,
            block,
            flat_no,
            project
        FROM status_data
        ORDER BY category, project, block, flat_no
    """

    category_status_data = frappe.db.sql(category_status_query, as_dict=True)

    # -----------------------------------
    # FINAL RESPONSE
    # -----------------------------------
    return {
        "requirements": requirements_data,
        "category_status": category_status_data
    }

@frappe.whitelist()
def get_customer_basic_details():

    query = """
        SELECT
            customer_name AS "Customer Name",
            custom_project AS "Project",
            custom_block AS "Block",
            custom_flat_no AS "Flat No",
            custom_purchase_from AS "Purchase From",
            custom_site_owner_name AS "Site Owner Name",
            custom_seller_name AS "Name Of Seller",
            custom_wattsapp_no AS "WhatsApp No",
            custom_residence AS "Residence",
            custom_occupation AS "Occupation",
            custom_flat_status AS "Flat Status",
            custom_date_of_booking AS "Booking Date"
        FROM
            `tabCustomer`
        ORDER BY
            custom_flat_no
    """

    return frappe.db.sql(query, as_dict=True)


import frappe

@frappe.whitelist()
def get_customer_modifications_data():
    """
    Fetch detailed customer modifications including amounts, status, and dates.
    """

    query = """
        WITH detailed AS (
            SELECT
                parent.custom_block AS `Block`,
                parent.custom_project AS `Project`,
                parent.custom_flat_no AS `Flat No`,
                parent.customer_name AS `Customer Name`,
                child.received_date AS `Received Date`,
                child.department AS `Department`,
                child.authorized_by AS `Authorized By`,
                CAST(COALESCE(child.total_amount, 0) AS UNSIGNED) AS `Total Amount`,
                CAST(COALESCE(child.amount_paid, 0) AS UNSIGNED) AS `Amount Paid`,
                CAST(COALESCE(child.balance_amount, 0) AS UNSIGNED) AS `Balance Amount`,
                child.status AS `Status`,
                child.date_of_completed AS `Date Of Completed`
            FROM
                `tabCustomer` AS parent
            LEFT JOIN
                `tabCustomer Modifications Table CRM` AS child 
                ON parent.name = child.parent
        )
        SELECT * 
        FROM detailed
        ORDER BY Block, `Flat No`
    """

    # Execute SQL query and return as a list of dictionaries
    results = frappe.db.sql(query, as_dict=True)
    return results