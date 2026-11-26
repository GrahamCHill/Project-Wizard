-- Customers grouped by the month of their first purchase, and how many of them bought again in each later month.
-- months_since = 0 is the cohort's first month, so its count is the size of the cohort.
WITH first_purchase AS (
    SELECT customer_id, min(date_trunc('month', ordered_at))::DATE AS cohort
    FROM completed_sales
    GROUP BY customer_id
),
activity AS (
    SELECT DISTINCT customer_id, date_trunc('month', ordered_at)::DATE AS month
    FROM completed_sales
)
SELECT f.cohort,
       date_diff('month', f.cohort, a.month) AS months_since,
       COUNT(DISTINCT a.customer_id)         AS customers
FROM first_purchase AS f
JOIN activity AS a USING (customer_id)
GROUP BY f.cohort, months_since
ORDER BY f.cohort, months_since;
