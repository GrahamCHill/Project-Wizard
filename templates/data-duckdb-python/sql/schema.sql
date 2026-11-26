-- The warehouse schema. `python -m shop_analytics load` runs this, then loads the CSV files in data/.
-- DuckDB enforces primary keys, foreign keys, and CHECK constraints, so bad data is rejected as it is loaded.

DROP VIEW IF EXISTS completed_sales;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    country     VARCHAR NOT NULL,
    signup_date DATE    NOT NULL
);

CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    name       VARCHAR       NOT NULL,
    category   VARCHAR       NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0)
);

CREATE TABLE orders (
    order_id    INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers (customer_id),
    product_id  INTEGER NOT NULL REFERENCES products (product_id),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    ordered_at  DATE    NOT NULL,
    status      VARCHAR NOT NULL CHECK (status IN ('completed', 'refunded', 'cancelled'))
);

-- Every report starts from this view, so "revenue" means the same thing everywhere: completed orders only.
CREATE VIEW completed_sales AS
SELECT o.order_id, o.ordered_at, c.customer_id, c.name AS customer, c.country,
       p.name AS product, p.category, o.quantity, o.quantity * p.unit_price AS revenue
FROM orders AS o
JOIN customers AS c USING (customer_id)
JOIN products AS p USING (product_id)
WHERE o.status = 'completed';
