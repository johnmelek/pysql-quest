"""Writes tycoon/company.sql: the client company every SQL contract runs against. Fixed seed, so it never changes by itself."""
import os, random

random.seed(7)
q = lambda v: "NULL" if v is None else str(v) if isinstance(v, (int, float)) else "'" + str(v).replace("'", "''") + "'"
out = []
def table(ddl, name, cols, rows):
    out.append(ddl)
    for r in rows:
        out.append(f"INSERT INTO {name} ({', '.join(cols)}) VALUES ({', '.join(q(v) for v in r)});")
    out.append("")

depts = [(1, "Sales", "Lyon"), (2, "Support", "Lyon"), (3, "Finance", "Paris"), (4, "Warehouse", "Marseille"), (5, "IT", "Paris"), (6, "Legal", "Paris")]
table("CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);", "departments", ["id", "name", "city"], depts)

first = ["Lea", "Hugo", "Nina", "Omar", "Ines", "Theo", "Sara", "Yanis", "Chloe", "Adam", "Emma", "Karim", "Lina", "Paul", "Zoe", "Malik", "Julie", "Noah", "Alice", "Rayan"]
last = ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Garcia", "Roux", "Fournier"]
emps = [(1, "Claire Durand", "CEO", None, None, 9800, "2015-03-01")]
heads = {1: 2, 2: 3, 3: 4, 4: 5, 5: 6}
for d, eid in heads.items():
    emps.append((eid, f"{first[eid]} {last[eid % 10]}", "Head of " + depts[d - 1][1], d, 1, 6200 + 150 * d, f"201{5 + d % 4}-0{d}-15"))
eid = 7
for d in range(1, 6):
    for k in range(3 if d != 5 else 2):
        role = {1: "Sales rep", 2: "Agent", 3: "Accountant", 4: "Picker", 5: "Developer"}[d]
        emps.append((eid, f"{first[eid % 20]} {last[(eid * 3) % 10]}", role, d, heads[d], 2600 + random.randrange(0, 1800, 50), f"20{18 + k + d % 3}-{1 + (eid % 12):02d}-0{1 + k}"))
        eid += 1
emps.append((eid, "Victor Lambert", "Intern", 5, 6, 1200, "2025-09-01")); eid += 1
emps.append((eid, "Manon Petit", "Consultant", None, 1, 3900, "2024-02-12"))
table("CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT, dept_id INTEGER REFERENCES departments(id), manager_id INTEGER REFERENCES employees(id), salary INTEGER, hired TEXT);",
      "employees", ["id", "name", "role", "dept_id", "manager_id", "salary", "hired"], emps)

cities = ["Lyon", "Paris", "Marseille", "Lille", "Nantes", "Bordeaux"]
comps = ["Atelier Brun", "Boulangerie Soleil", "Cafe du Port", "Garage Central", "Hotel Riviera", "Imprimerie Lumen", "Jardins Verts", "Kiosque Nord", "Librairie Page", "Menuiserie Bois", "Nettoyage Pro", "Optique Claire", "Pharmacie Rhone", "Quincaillerie Fer", "Restaurant Olive", "Studio Pixel", "Transports Rapides", "Union Sports", "Vins et Caves", "Zenith Fitness"]
custs = []
for i, c in enumerate(comps, 1):
    email = None if i in (4, 13) else c.lower().replace(" ", ".") + "@mail.fr"
    custs.append((i, c, cities[i % 6], email, f"202{2 + i % 4}-{1 + i % 12:02d}-{1 + i % 27:02d}", ["standard", "gold", "standard", "platinum"][i % 4]))
table("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT, email TEXT, joined TEXT, tier TEXT);",
      "customers", ["id", "name", "city", "email", "joined", "tier"], custs)

prods = [(1, "Laptop Pro 14", "Hardware", 1290.0, 12), (2, "Office Chair", "Furniture", 249.0, 30), (3, "Standing Desk", "Furniture", 480.0, 8), (4, "Monitor 27", "Hardware", 329.0, 25),
         (5, "Keyboard", "Hardware", 59.9, 70), (6, "Mouse", "Hardware", 24.5, 120), (7, "Printer Ink", "Supplies", 39.0, 0), (8, "Paper Box", "Supplies", 18.0, 200),
         (9, "Cloud Backup (year)", "Services", 120.0, None), (10, "Support Plan (year)", "Services", 600.0, None), (11, "Headset", "Hardware", 89.0, 15), (12, "Whiteboard", "Furniture", 140.0, 4)]
table("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL, stock INTEGER);",
      "products", ["id", "name", "category", "price", "stock"], prods)

orders, items, oid, iid = [], [], 1, 1
reps = [e[0] for e in emps if e[2] == "Sales rep"]
for m in range(1, 11):
    for k in range(4):
        cust = random.choice([c for c in range(1, 21) if c not in (19, 20)])
        status = random.choice(["paid", "paid", "paid", "shipped", "pending", "cancelled"])
        orders.append((oid, cust, random.choice(reps), f"2026-{m:02d}-{random.randint(1, 28):02d}", status))
        for p in random.sample(range(1, 13), random.randint(1, 3)):
            items.append((iid, oid, p, random.randint(1, 5), prods[p - 1][3])); iid += 1
        oid += 1
table("CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), rep_id INTEGER REFERENCES employees(id), ordered TEXT, status TEXT);",
      "orders", ["id", "customer_id", "rep_id", "ordered", "status"], orders)
table("CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id), qty INTEGER, unit_price REAL);",
      "order_items", ["id", "order_id", "product_id", "qty", "unit_price"], items)

pays, pid = [], 1
for o in orders:
    if o[4] in ("paid", "shipped"):
        total = round(sum(i[3] * i[4] for i in items if i[1] == o[0]), 2)
        if random.random() < .25:
            half = round(total / 2, 2)
            pays += [(pid, o[0], half, o[3], "card"), (pid + 1, o[0], round(total - half, 2), o[3], "transfer")]; pid += 2
        else:
            pays.append((pid, o[0], total, o[3], random.choice(["card", "transfer", "card"]))); pid += 1
table("CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), amount REAL, paid_on TEXT, method TEXT);",
      "payments", ["id", "order_id", "amount", "paid_on", "method"], pays)

agents = [e[0] for e in emps if e[2] == "Agent"]
subjects = ["Invoice missing", "Login fails", "Late delivery", "Wrong item", "Refund request", "Printer offline", "Password reset", "Damaged box"]
tickets = []
for t in range(1, 31):
    opened = f"2026-{random.randint(1, 10):02d}-{random.randint(1, 28):02d}"
    closed = None if t % 5 == 0 else opened[:8] + f"{min(28, int(opened[8:]) + random.randint(0, 6)):02d}"
    tickets.append((t, random.randint(1, 20), None if t % 9 == 0 else random.choice(agents), random.choice(subjects), random.choice(["low", "normal", "normal", "high"]), opened, closed))
table("CREATE TABLE tickets (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), agent_id INTEGER REFERENCES employees(id), subject TEXT, priority TEXT, opened TEXT, closed TEXT);",
      "tickets", ["id", "customer_id", "agent_id", "subject", "priority", "opened", "closed"], tickets)

open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "company.sql"), "w", encoding="utf8", newline="\n").write(
    "-- Script City: the client company. Generated by make_company.py, do not edit by hand.\n" + "\n".join(out))
