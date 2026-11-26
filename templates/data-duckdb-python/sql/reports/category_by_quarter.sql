-- Revenue for each product category, one column per quarter.
-- PIVOT turns the values of a column (the quarters) into columns of the result.
PIVOT (
    SELECT category, 'Q' || quarter(ordered_at) AS quarter, revenue
    FROM completed_sales
)
ON quarter IN ('Q1', 'Q2', 'Q3', 'Q4')
USING SUM(revenue)
GROUP BY category
ORDER BY category;
