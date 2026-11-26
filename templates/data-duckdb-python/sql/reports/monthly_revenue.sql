-- Revenue per month, a running total, and the change from the previous month.
-- Window functions: SUM() OVER for the running total and LAG() for the previous month.
WITH monthly AS (
    SELECT date_trunc('month', ordered_at)::DATE AS month,
           COUNT(*)     AS orders,
           SUM(revenue) AS revenue
    FROM completed_sales
    GROUP BY 1
)
SELECT month,
       orders,
       revenue,
       SUM(revenue) OVER (ORDER BY month) AS running_total,
       round(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1) AS change_pct
FROM monthly
ORDER BY month;
