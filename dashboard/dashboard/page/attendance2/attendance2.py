import frappe

@frappe.whitelist()
def get_employee_attendance(date=None, department="All Departments", branch="All Branches"):

    date = date or frappe.utils.today()

    query = """
    SELECT
        %(date)s AS `Date`,
        e.name AS `Emp ID`,
        e.employee_name AS `Employee`,

        COALESCE(e.branch, 'No Branch') AS `branch`,
        COALESCE(e.department, 'No Department') AS `department`,

        TIME(MIN(ec.time)) AS `Check In`,

        CASE
            WHEN COUNT(ec.time) > 1 THEN TIME(MAX(ec.time))
            ELSE NULL
        END AS `Check Out`,

        CASE
            WHEN COUNT(ec.time) > 1 THEN
                CONCAT(
                    FLOOR(TIMESTAMPDIFF(MINUTE, MIN(ec.time), MAX(ec.time)) / 60),
                    'hrs ',
                    MOD(TIMESTAMPDIFF(MINUTE, MIN(ec.time), MAX(ec.time)), 60),
                    'min'
                )
            ELSE NULL
        END AS `Worked Hours`,

        CASE
            WHEN COUNT(ec.time) > 1
             AND TIMESTAMPDIFF(MINUTE, MIN(ec.time), MAX(ec.time)) > 540
            THEN
                CONCAT(
                    FLOOR((TIMESTAMPDIFF(MINUTE, MIN(ec.time), MAX(ec.time)) - 540) / 60),
                    'hrs ',
                    MOD((TIMESTAMPDIFF(MINUTE, MIN(ec.time), MAX(ec.time)) - 540), 60),
                    'min'
                )
            ELSE '0hrs 0min'
        END AS `OT`,

        CASE
            WHEN COUNT(ec.time) > 0 THEN 'Present'
            WHEN DAYOFWEEK(%(date)s) = 1 THEN 'Week Off'
            WHEN h.holiday_date IS NOT NULL THEN 'Holiday'
            ELSE 'Absent'
        END AS `Status`

    FROM `tabEmployee` e

    LEFT JOIN `tabEmployee Checkin` ec
        ON ec.employee = e.name
       AND DATE(ec.time) = %(date)s

    LEFT JOIN `tabHoliday` h
        ON h.holiday_date = %(date)s
       AND h.parent = e.holiday_list

    WHERE
        e.status = 'Active'
        AND (%(department)s = 'All Departments' OR e.department = %(department)s)
        AND (%(branch)s = 'All Branches' OR e.branch = %(branch)s)

    GROUP BY e.name, e.employee_name, e.branch, e.department
    ORDER BY e.name
    """

    return frappe.db.sql(query, {
        "date": date,
        "department": department,
        "branch": branch
    }, as_dict=True)


@frappe.whitelist()
def get_branch_wise_attendance(date=None, department="All Departments"):

    date = date or frappe.utils.today()

    employees = frappe.db.sql("""
        SELECT
            COALESCE(e.branch, 'No Branch') AS branch,
            e.name AS emp_id,
            e.employee_name AS employee,
            DATE(ec.time) AS date,
            MIN(ec.time) AS first_checkin,
            MAX(ec.time) AS last_checkout,
            CASE
                WHEN COUNT(ec.name) > 0 THEN 'Present'
                ELSE 'Absent'
            END AS status
        FROM `tabEmployee` e
        LEFT JOIN `tabEmployee Checkin` ec
            ON ec.employee = e.name
            AND DATE(ec.time) = %(date)s
        WHERE e.status = 'Active'
        GROUP BY e.name
    """, {"date": date}, as_dict=True)

    result = {}

    for e in employees:
        if e.branch not in result:
            result[e.branch] = {
                "branch": e.branch,
                "total": 0,
                "present": 0,
                "details": []
            }

        result[e.branch]["total"] += 1

        if e.status == "Present":
            result[e.branch]["present"] += 1

        result[e.branch]["details"].append(e)

    return list(result.values())