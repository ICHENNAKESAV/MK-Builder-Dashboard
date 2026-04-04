import os
import frappe

def create_page_py(doc, method):
    page_name = doc.page_name.lower().replace(" ", "_")

    app_path = frappe.get_app_path("dashboard")

    page_path = os.path.join(
        app_path,
        "dashboard",
        "page",
        page_name
    )

    # ✅ FIX: create directory if missing
    os.makedirs(page_path, exist_ok=True)

    py_file = os.path.join(page_path, f"{page_name}.py")

    if os.path.exists(py_file):
        return

    with open(py_file, "w") as f:
        f.write(f"""# Auto-generated file

import frappe

def get_context(context):
    context.title = "{page_name.replace("_", " ").title()}"
""")

    frappe.logger().info(f"Created Python file: {py_file}")