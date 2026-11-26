-- The five customers who spent the most. Customers that tie share a rank, so there can be more than five rows.
-- QUALIFY filters on a window function the way HAVING filters on an aggregate.
SELECT customer,
       country,
       COUNT(*)     AS orders,
       SUM(revenue) AS revenue,
       rank() OVER (ORDER BY SUM(revenue) DESC) AS rank
FROM completed_sales
GROUP BY customer, country
QUALIFY rank <= 5
ORDER BY rank, customer;
