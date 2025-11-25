import re


with open("./database.cql", "r") as f:
    table_definitions = f.read()

TABLE_REGEX = r"CREATE TABLE (\w+\.\w+) \((.*?)\);"

tables = {}

class Row:
    def __init__(self, definition: str):
        parts = definition.split()
        key, datatype, *rest = parts
        nullable = "NOT NULL" not in rest
        self.key = key
        self.datatype = datatype
        self.nullable = nullable

    def __repr__(self):
        return f"<Row {self.key}: {self.datatype}{' NOT NULL' if not self.nullable else ''}>"

class Table:
    def __init__(self, name: str, rows: list[str]):
        self.name: str = name
        self.rows: list[Row] = []
        self.pk: str

        for row in rows:
            if row.startswith("PRIMARY KEY"):
                self.pk = row
            elif row.startswith("--"):
                continue
            else:
                self.rows.append(Row(row))
    def __repr__(self):
        return f"<Table {self.name} {self.pk} with {self.rows}>"


for match in re.finditer(TABLE_REGEX, table_definitions, re.DOTALL):
    name, rows = match.groups()
    rows = [row for row in (row.strip() for row in rows.split("\n")) if row and not row.startswith("--")]
    t = Table(name, rows)
    print(t)
    tables[name] = t