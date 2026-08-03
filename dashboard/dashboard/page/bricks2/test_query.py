import frappe
from dashboard.dashboard.page.bricks2.bricks2 import get_stock_balance_summary

def execute():
    try:
        companies = frappe.db.get_all("Company", pluck="name")
        print("Companies:", companies)
        if companies:
            res = get_stock_balance_summary(company=companies[0], from_date="2025-12-09", to_date="2026-07-31")
            print("RESULT_LEN with company:", len(res))
            if res:
                print(res[0])
            
            # Let's test with empty company too
            res2 = get_stock_balance_summary(company="", from_date="2025-12-09", to_date="2026-07-31")
            print("RESULT_LEN with empty company:", len(res2))
            
            # Print without item filtering just to see
            sle = frappe.qb.DocType("Stock Ledger Entry")
            q = frappe.qb.from_(sle).select(sle.item_code).where(sle.item_code.isin(['CEMENT BRICKS 9"X4"X3"', 'CEMENT BRICKS 9"X6"X3"'])).limit(5)
            print("BRICK ITEMS IN SLE:", q.run())

            q2 = frappe.qb.from_(sle).select(sle.item_code).where(sle.item_code.like('CEMENT BRICKS%')).limit(5)
            print("ALL BRICKS IN SLE:", q2.run())
            
    except Exception as e:
        import traceback
        traceback.print_exc()
