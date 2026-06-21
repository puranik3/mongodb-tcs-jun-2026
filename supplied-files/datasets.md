# Datasets

Datasets used in this course are available in the `supplied-files/datasets` directory. The following table summarizes the collections and their approximate record counts, along with the purpose of each dataset in the context of learning MongoDB concepts.

| Collection                                                  |      Approx. Records | Purpose                                                                   |
| ----------------------------------------------------------- | -------------------: | ------------------------------------------------------------------------- |
| [`users`](./datasets/users.ndjson)                          |               50,000 | Filtering, sorting, selectivity, compound indexes, projections            |
| [`products`](./datasets/products.ndjson)                    |               10,000 | Text indexes, category filters, price/rating indexes, attribute pattern   |
| [`categories`](./datasets/categories.ndjson)                |                   49 | Simple reference data, category hierarchy                                 |
| [`orders`](./datasets/orders.ndjson)                        |              100,000 | Compound indexes, ESR rule, date-range queries, customer order history    |
| `order_items` - embedded order items in `orders`            |                   NA | Schema design: embedding vs referencing, document growth                  |
| [`reviews`](./datasets/reviews.ndjson)                      |              100,000 | Multikey-style access patterns, product/user lookups, sort by rating/date |
| [`inventory`](./datasets/inventory.ndjson)                  |               20,000 | Product-stock lookup, warehouse queries, update-heavy collection          |
| [`support_tickets`](./datasets/support_tickets.ndjson)      |               25,000 | Text search, status/date filtering, case-study optimization               |
| [`product_events`](./datasets/product_events.ndjson)        |              100,000 | Bucket pattern demo, high-volume time-series-style events                 |
| **Total**                                                   |              405,049 |                                                                           |