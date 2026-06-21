# MongoDB Advanced Topics Lab Guide

## Overview

This lab guide supports the 8-hour MongoDB Advanced Topics training.

- **Session 1:** MongoDB Indexing and Query Performance Optimization
- **Session 2:** Strategic Schema Design in MongoDB
- **Database name:** `ecommerce`
- **Dataset files:** `users.ndjson`, `products.ndjson`, `categories.ndjson`, `orders.ndjson`, `reviews.ndjson`, `inventory.ndjson`, `support_tickets.ndjson`, `product_events.ndjson`

The guide mixes explanation with exercises. Participants should run each query, observe the output, and compare behavior before and after optimization.

---

# Setup and Verification

## 1. Start MongoDB Shell

```bash
mongosh
```

Switch to the training database:

```js
use ecommerce
```

Check collections:

```js
show collections
```

Expected collections:

```text
users
products
categories
orders
reviews
inventory
support_tickets
product_events
```

## 2. Verify Document Counts

```js
db.users.countDocuments()
db.products.countDocuments()
db.categories.countDocuments()
db.orders.countDocuments()
db.reviews.countDocuments()
db.inventory.countDocuments()
db.support_tickets.countDocuments()
db.product_events.countDocuments()
```

Expected counts:

| Collection | Expected Count |
|---|---:|
| `users` | 50,000 |
| `products` | 10,000 |
| `categories` | 49 |
| `orders` | 100,000 |
| `reviews` | 100,000 |
| `inventory` | 20,000 |
| `support_tickets` | 25,000 |
| `product_events` | 100,000 |

## 3. Check Existing Indexes

Since data was imported using `mongoimport`, the collections should initially have only the default `_id` index unless indexes were manually created earlier.

```js
db.users.getIndexes()
db.products.getIndexes()
db.orders.getIndexes()
```

Every collection has this default index:

```js
{ key: { _id: 1 }, name: "_id_" }
```

For the indexing labs, it is best to start with only the `_id` index. We will create additional indexes step by step.

---

# Session 1: MongoDB Indexing and Query Performance Optimization

## Learning Outcome

By the end of this session, participants will understand query execution and indexing, design efficient indexes using the ESR rule, optimize queries using `explain()`, convert `COLLSCAN` to `IXSCAN`, and improve performance using projections and limits.

---

## 1. Introduction to Query Performance in MongoDB

MongoDB stores data as documents inside collections. When a query runs, MongoDB must locate matching documents.

Query performance depends mainly on:

- how many documents MongoDB examines
- whether a useful index exists
- whether sorting can use an index
- whether the query fetches unnecessary fields
- whether the query returns too many documents

In this session, use this repeated workflow:

1. Run a query without a custom index.
2. Inspect the query plan using `explain()`.
3. Identify whether MongoDB uses `COLLSCAN` or `IXSCAN`.
4. Create a suitable index.
5. Run the query again.
6. Compare execution statistics.

---

## 2. COLLSCAN vs IXSCAN

### Concept

A `COLLSCAN` means MongoDB scans the collection document by document.

An `IXSCAN` means MongoDB scans an index to locate matching documents.

Common plan stages:

| Stage | Meaning |
|---|---|
| `COLLSCAN` | MongoDB scanned documents in the collection |
| `IXSCAN` | MongoDB scanned an index |
| `FETCH` | MongoDB used an index, then fetched matching documents |
| `SORT` | MongoDB performed an in-memory sort |
| `PROJECTION_SIMPLE` | MongoDB returned selected fields |
| `PROJECTION_COVERED` | MongoDB answered using only the index |

A `COLLSCAN` is not always bad for tiny collections. But on large collections, repeated collection scans usually become expensive.

### Exercise 1: Observe a COLLSCAN

Run:

```js
db.products.find({
  category: "electronics"
})
```

Now inspect the execution plan:

```js
db.products.find({
  category: "electronics"
}).explain("executionStats")
```

Inspect only the winning plan:

```js
db.products.find({
  category: "electronics"
}).explain("executionStats").queryPlanner.winningPlan
```

Look for:

```js
executionStats.nReturned
executionStats.totalDocsExamined
executionStats.totalKeysExamined
executionStats.executionTimeMillis
```

### Expected Observation

Since no index exists yet on `category`, MongoDB should use a collection scan.

You should see a stage similar to:

```js
stage: "COLLSCAN"
```

### Reflection

1. How many documents were returned?
2. How many documents were examined?
3. Did MongoDB examine more documents than it returned?
4. Why is that inefficient on large collections?

---

## 3. Using `explain()` for Query Plans

### Concept

`explain()` shows how MongoDB plans and executes a query.

Common modes:

```js
.explain()
.explain("queryPlanner")
.explain("executionStats")
.explain("allPlansExecution")
```

For this training, use:

```js
.explain("executionStats")
```

Important fields:

| Field | Meaning |
|---|---|
| `nReturned` | Number of documents returned |
| `totalDocsExamined` | Number of documents inspected |
| `totalKeysExamined` | Number of index entries inspected |
| `executionTimeMillis` | Approximate execution time |
| `winningPlan` | Plan selected by MongoDB |
| `rejectedPlans` | Plans considered but not selected |

### Exercise 2: Compare Query Shapes

Run the following with `explain("executionStats")`.

#### Query A: Low-cardinality field

```js
db.users.find({
  status: "active"
}).explain("executionStats")
```

#### Query B: More selective field

Find an existing email:

```js
db.users.findOne({}, { email: 1 })
```

Then use it:

```js
db.users.find({
  email: "<paste-email-here>"
}).explain("executionStats")
```

#### Query C: City and segment

```js
db.users.find({
  "address.city": "Bengaluru",
  segment: "premium"
}).explain("executionStats")
```

Record observations:

| Query | nReturned | totalDocsExamined | totalKeysExamined | Main Stage |
|---|---:|---:|---:|---|
| A | | | | |
| B | | | | |
| C | | | | |

### Reflection

1. Which query returned the fewest documents?
2. Which query examined the most documents?
3. Which field appears more selective: `status`, `email`, or `address.city`?
4. Why does selectivity matter when designing indexes?

---

## 4. Index Selectivity and Cardinality

### Concept

Cardinality means the number of distinct values in a field.

Examples:

| Field | Cardinality |
|---|---|
| `status` | Low |
| `segment` | Low |
| `address.city` | Medium |
| `email` | High |
| `userId` | High |

Selectivity means how effectively a condition reduces the number of matching documents.

Highly selective:

```js
{ email: "some-user@example.com" }
```

Less selective:

```js
{ status: "active" }
```

### Exercise 3: Compare Cardinality

```js
db.users.distinct("status")
db.users.distinct("segment")
db.users.distinct("address.city")
```

Check distribution:

```js
db.users.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

```js
db.users.aggregate([
  { $group: { _id: "$segment", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

```js
db.users.aggregate([
  { $group: { _id: "$address.city", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

### Reflection

1. Which field has the lowest cardinality?
2. Which field has higher cardinality?
3. Would an index on `status` alone always be useful?
4. Why might `{ status: 1, createdAt: -1 }` be more useful than `{ status: 1 }`?

---

## 5. Creating and Managing Indexes

### Concept

An index stores selected field values in a structure MongoDB can scan efficiently.

Create an index:

```js
db.products.createIndex({ category: 1 })
```

Check indexes:

```js
db.products.getIndexes()
```

Drop an index:

```js
db.products.dropIndex("category_1")
```

Drop all non-`_id` indexes:

```js
db.products.dropIndexes()
```

### Exercise 4: Convert COLLSCAN to IXSCAN

Create the index:

```js
db.products.createIndex({ category: 1 })
```

Rerun:

```js
db.products.find({
  category: "electronics"
}).explain("executionStats")
```

### Expected Observation

The query should now use `IXSCAN`.

You may see a plan like:

```text
IXSCAN -> FETCH
```

This means MongoDB used the index to find matching document locations, then fetched the full documents.

### Exercise 5: Before/After Comparison

Record:

| Metric | Before Index | After Index |
|---|---:|---:|
| nReturned | | |
| totalDocsExamined | | |
| totalKeysExamined | | |
| executionTimeMillis | | |
| Main Stage | | |

### Reflection

1. Did `totalDocsExamined` reduce?
2. Did `totalKeysExamined` increase?
3. Why is scanning index keys cheaper than scanning full documents?
4. Did the query still need a `FETCH` stage?

---

## 6. Index Types

## 6.1 Single Field Index

A single field index supports queries on one field.

```js
db.users.createIndex({ email: 1 })
```

Exercise:

```js
db.users.findOne({}, { email: 1 })
```

```js
db.users.find({
  email: "<paste-email-here>"
}).explain("executionStats")
```

Expected: very small `totalDocsExamined` and `totalKeysExamined`.

---

## 6.2 Compound Index

A compound index contains multiple fields.

```js
db.orders.createIndex({ userId: 1, createdAt: -1 })
```

Useful for queries like:

```js
db.orders.find({
  userId: "U000100"
}).sort({ createdAt: -1 }).explain("executionStats")
```

### Exercise

Run before creating the index:

```js
db.orders.find({
  userId: "U000100"
}).sort({ createdAt: -1 }).explain("executionStats")
```

Create index:

```js
db.orders.createIndex({ userId: 1, createdAt: -1 })
```

Run again:

```js
db.orders.find({
  userId: "U000100"
}).sort({ createdAt: -1 }).explain("executionStats")
```

Reflection:

1. Did the query avoid in-memory sort?
2. Did `totalDocsExamined` reduce?
3. Why does field order matter in a compound index?

---

## 6.3 Multikey Index

A multikey index is created when indexing an array field.

The `products` collection has array fields:

```js
tags
attributes
```

Create an index on `tags`:

```js
db.products.createIndex({ tags: 1 })
```

Query:

```js
db.products.find({
  tags: "best-seller"
}).explain("executionStats")
```

### Exercise

Compare query performance before and after the index.

Reflection:

1. Why is this a multikey index?
2. Why can one document create multiple index entries?
3. What trade-off does this create?

---

## 6.4 Text Index

A text index supports text search on string fields.

Create a text index:

```js
db.products.createIndex({
  name: "text",
  description: "text",
  tags: "text"
})
```

Run:

```js
db.products.find({
  $text: { $search: "smart premium" }
})
```

Project text score:

```js
db.products.find(
  { $text: { $search: "smart premium" } },
  { score: { $meta: "textScore" }, name: 1, category: 1 }
).sort({ score: { $meta: "textScore" } })
```

### Reflection

1. Why is a text index different from a normal ascending index?
2. What types of search problems can text indexes help with?
3. When would a text index not be enough?

---

## 6.5 Hashed Index

A hashed index stores hashed values of a field. It is useful for equality lookups and is commonly discussed in the context of shard key distribution.

Create:

```js
db.product_events.createIndex({ sessionId: "hashed" })
```

Query:

```js
db.product_events.find({
  sessionId: "S0001000"
}).explain("executionStats")
```

### Reflection

1. Why are hashed indexes useful for equality matches?
2. Are hashed indexes useful for range queries?
3. Why might hashed indexes distribute writes more evenly?

---

## 7. ESR Rule: Equality, Sort, Range

### Concept

The ESR rule is a practical guideline for compound index field order:

1. **Equality** fields first
2. **Sort** fields next
3. **Range** fields last

Example query:

```js
db.orders.find({
  status: "delivered",
  totalAmount: { $gte: 5000 }
}).sort({ createdAt: -1 })
```

Following ESR:

- Equality: `status`
- Sort: `createdAt`
- Range: `totalAmount`

Index:

```js
db.orders.createIndex({ status: 1, createdAt: -1, totalAmount: 1 })
```

### Exercise 6: Apply ESR

Run before index:

```js
db.orders.find({
  status: "delivered",
  totalAmount: { $gte: 5000 }
}).sort({ createdAt: -1 }).explain("executionStats")
```

Create index:

```js
db.orders.createIndex({ status: 1, createdAt: -1, totalAmount: 1 })
```

Run again:

```js
db.orders.find({
  status: "delivered",
  totalAmount: { $gte: 5000 }
}).sort({ createdAt: -1 }).explain("executionStats")
```

### Reflection

1. Which field is the equality field?
2. Which field is used for sorting?
3. Which field is the range field?
4. Did the index help with filtering and sorting?

---

## 8. Covered Queries

### Concept

A covered query can be answered using only the index, without fetching full documents.

For a query to be covered:

1. Filter fields must be in the index.
2. Projected fields must be in the index.
3. `_id` must be excluded unless `_id` is part of the index.

Create index:

```js
db.users.createIndex({ status: 1, email: 1, userId: 1 })
```

Run:

```js
db.users.find(
  { status: "active" },
  { _id: 0, email: 1, userId: 1 }
).explain("executionStats")
```

### Expected Observation

You may see `PROJECTION_COVERED`, and `totalDocsExamined` should be `0`.

### Exercise 7: Break the Covered Query

Run:

```js
db.users.find(
  { status: "active" },
  { _id: 0, email: 1, userId: 1, loyaltyPoints: 1 }
).explain("executionStats")
```

Reflection:

1. Why is this no longer covered?
2. What changed in `totalDocsExamined`?
3. Why can covered queries be very efficient?

---

## 9. Filtering and Limiting Data Volume

### Concept

Even with indexes, returning too many documents can be expensive.

Use filters and limits to reduce data volume.

Poor query:

```js
db.orders.find({ status: "delivered" })
```

Better query:

```js
db.orders.find({ status: "delivered" })
  .sort({ createdAt: -1 })
  .limit(20)
```

### Exercise 8: Add Limit

Create index:

```js
db.orders.createIndex({ status: 1, createdAt: -1 })
```

Run without limit:

```js
db.orders.find({
  status: "delivered"
}).sort({ createdAt: -1 }).explain("executionStats")
```

Run with limit:

```js
db.orders.find({
  status: "delivered"
}).sort({ createdAt: -1 }).limit(20).explain("executionStats")
```

Reflection:

1. Did `nReturned` reduce?
2. Did MongoDB need to scan fewer keys?
3. Why is `limit()` important for API endpoints?

---

## 10. Avoiding Over-fetching

### Concept

Over-fetching means returning more fields than required.

Example:

```js
db.products.find({ category: "electronics" })
```

This returns entire product documents.

Better:

```js
db.products.find(
  { category: "electronics" },
  { name: 1, price: 1, rating: 1, _id: 0 }
)
```

### Exercise 9: Use Projection

Run:

```js
db.products.find(
  { category: "electronics" },
  { name: 1, price: 1, rating: 1, _id: 0 }
).limit(10)
```

Then explain:

```js
db.products.find(
  { category: "electronics" },
  { name: 1, price: 1, rating: 1, _id: 0 }
).limit(10).explain("executionStats")
```

Reflection:

1. Does projection reduce documents examined?
2. Does projection reduce network payload?
3. Why is projection useful even if it does not always change the query plan?

---

## 11. Sorting with Indexes

### Concept

Sorting can be expensive if MongoDB must sort in memory.

A good index can support both filtering and sorting.

Example query:

```js
db.products.find({
  category: "electronics"
}).sort({ price: 1 })
```

Useful index:

```js
db.products.createIndex({ category: 1, price: 1 })
```

### Exercise 10: Remove In-Memory Sort

Run before index:

```js
db.products.find({
  category: "electronics"
}).sort({ price: 1 }).explain("executionStats")
```

Create index:

```js
db.products.createIndex({ category: 1, price: 1 })
```

Run again:

```js
db.products.find({
  category: "electronics"
}).sort({ price: 1 }).explain("executionStats")
```

Reflection:

1. Did the plan contain a `SORT` stage before the index?
2. Did the index remove or reduce sorting work?
3. Why is `{ category: 1, price: 1 }` better than `{ price: 1, category: 1 }` for this query?

---

## 12. Index Maintenance and Trade-offs

### Concept

Indexes improve read performance but have costs.

Indexes:

- consume storage
- slow down inserts, updates, and deletes
- require maintenance
- can become unused or redundant
- should match real query patterns

Check index sizes:

```js
db.products.stats().indexSizes
```

Check all indexes:

```js
db.products.getIndexes()
```

### Exercise 11: Identify Possible Redundant Indexes

Suppose these indexes exist:

```js
{ category: 1 }
{ category: 1, price: 1 }
{ category: 1, price: 1, rating: -1 }
```

Reflection:

1. Can the compound index support queries on `category` alone?
2. Is `{ category: 1 }` always necessary?
3. When might keeping the smaller index still be useful?

---

## 13. Performance Anti-patterns

### Common Anti-patterns

| Anti-pattern | Problem |
|---|---|
| Indexing every field | High write and storage cost |
| Ignoring query patterns | Indexes may not help real queries |
| Low-selectivity indexes only | May not reduce scanned data enough |
| Large unbounded arrays | Document growth and large multikey indexes |
| Sorting without supporting index | In-memory sort overhead |
| Fetching full documents always | More network and memory usage |
| Using regex carelessly | May prevent efficient index usage |

### Exercise 12: Observe an Inefficient Pattern

Run:

```js
db.products.find({
  name: /Pro/
}).explain("executionStats")
```

Reflection:

1. Did this use an index effectively?
2. How many documents were examined?
3. Would a text index be better for search-like functionality?

---

# Session 1 Checkpoint

Participants should now be able to:

- identify `COLLSCAN` and `IXSCAN`
- use `explain("executionStats")`
- create single, compound, multikey, text, and hashed indexes
- apply the ESR rule
- understand covered queries
- reduce over-fetching using projections
- reduce returned data using `limit()`
- reason about index trade-offs

---

# Session 2: Strategic Schema Design in MongoDB

## Learning Outcome

By the end of this session, participants will be able to design scalable MongoDB schemas based on query patterns, understand embedding vs referencing, avoid unbounded arrays, apply schema patterns, and optimize data models for performance and scalability.

---

## 1. Introduction to Schema Design in MongoDB

MongoDB does not force a fixed schema, but schema design is still very important.

A good MongoDB schema is designed around:

- application query patterns
- read/write frequency
- relationship size
- data growth
- consistency needs
- scalability requirements

MongoDB schema design is not about removing structure. It is about choosing the right structure for the application.

---

## 2. Schema Design Principles

### Principle 1: Design for Queries

Start with the questions the application must answer.

Example:

```text
Show the latest 10 orders for a user.
```

This query suggests an order schema with:

```js
userId
createdAt
status
totalAmount
```

and an index:

```js
{ userId: 1, createdAt: -1 }
```

### Principle 2: Data Access Together Can Be Stored Together

If data is usually read together, embedding may be useful.

Example: order line items are embedded inside `orders`.

### Principle 3: Avoid Uncontrolled Growth

If an array can grow forever, do not embed it blindly.

Example: product reviews can grow very large, so they are stored in a separate `reviews` collection.

---

## 3. Query-driven Schema Design

### Concept

Before designing collections, identify query patterns.

For an e-commerce system:

| Query Pattern | Likely Collection |
|---|---|
| Show product listing by category and price | `products` |
| Show product details | `products` |
| Show latest orders for user | `orders` |
| Show reviews for product | `reviews` |
| Check stock by product and warehouse | `inventory` |
| Show open support tickets by priority | `support_tickets` |
| Analyze product activity by time | `product_events` |

### Exercise 13: Identify Query Patterns

For each screen, list the main query fields.

| Application Screen | Query Fields |
|---|---|
| Product listing page | |
| Product detail page | |
| User order history page | |
| Support dashboard | |
| Inventory dashboard | |

Example:

```text
User order history page: userId, createdAt, status
```

---

## 4. Embedding vs Referencing

### Concept

Embedding means storing related data inside the same document.

Referencing means storing related data in a separate collection and keeping an ID reference.

### Embedded Example: Order Items

In `orders`, items are embedded:

```js
db.orders.findOne({}, { items: 1 })
```

This is useful because order items are usually displayed with the order.

### Referenced Example: Product Reviews

Reviews are stored separately:

```js
db.reviews.find({ productId: "P000100" })
```

This avoids making the product document grow indefinitely.

### When to Embed

Embed when:

- child data is usually read with parent data
- child data is bounded
- child data does not need independent heavy querying
- parent and child are updated together

### When to Reference

Reference when:

- child data can grow without limit
- child data is queried independently
- many parents refer to the same child
- data changes frequently and should not be duplicated everywhere

### Exercise 14: Analyze Existing Design

Inspect one order:

```js
db.orders.findOne({}, { orderId: 1, userId: 1, items: 1 })
```

Inspect reviews for a product:

```js
db.reviews.find({ productId: "P000100" }).limit(5)
```

Reflection:

1. Why are order items embedded?
2. Why are reviews separate?
3. What would go wrong if all reviews were embedded inside products?

---

## 5. Modeling Relationships

## 5.1 One-to-One

Example: user and user preferences.

In this dataset, user preferences are embedded:

```js
db.users.findOne({}, { userId: 1, preferences: 1 })
```

This works because each user has one small preferences object.

## 5.2 One-to-Many

Example: user to orders.

A user can have many orders. Orders are stored separately and reference the user:

```js
db.orders.find({ userId: "U000100" })
```

## 5.3 Many-to-Many

Example: products and orders.

One order can contain many products. One product can appear in many orders.

The `orders.items` array stores product snapshots and product references.

```js
db.orders.findOne({}, { items: 1 })
```

### Exercise 15: Relationship Classification

Classify each relationship.

| Relationship | 1-1, 1-N, or N-N? | Embed or Reference? |
|---|---|---|
| User → Preferences | | |
| User → Orders | | |
| Order → Items | | |
| Product → Reviews | | |
| Product → Inventory | | |
| Product → Events | | |

---

## 6. Data Duplication vs Normalization

### Concept

MongoDB schemas often duplicate selected data to make reads faster.

Example from `orders.items`:

```js
{
  productId: "P000123",
  productRef: ObjectId("..."),
  nameSnapshot: "Electronics Product 123",
  unitPrice: 2499,
  quantity: 2,
  lineTotal: 4998
}
```

The order stores a product snapshot. This is intentional.

Benefits:

- order display is faster
- historical price is preserved
- fewer joins/lookups are required

Trade-off:

- duplicated data may become stale
- updates may need extra care

### Exercise 16: Product Snapshot Design

Inspect order items:

```js
db.orders.findOne({}, {
  orderId: 1,
  items: 1
})
```

Reflection:

1. Why store `nameSnapshot`?
2. Why store `unitPrice` inside the order?
3. Should an old order change if product price changes later?
4. Which fields should be duplicated and which should only be referenced?

---

## 7. Handling Document Growth

### Concept

MongoDB documents have a maximum size. Even before that limit, very large documents become inefficient.

Document growth becomes risky when:

- arrays keep growing
- frequent updates increase document movement
- large documents are read when only small parts are needed

### Exercise 17: Compare Bounded and Unbounded Data

Order items are bounded in this dataset:

```js
db.orders.aggregate([
  { $group: { _id: "$itemCount", count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
])
```

Reviews are potentially unbounded:

```js
db.reviews.aggregate([
  { $group: { _id: "$productId", reviewCount: { $sum: 1 } } },
  { $sort: { reviewCount: -1 } },
  { $limit: 10 }
])
```

Reflection:

1. Why is `items` safer to embed than `reviews`?
2. What happens if a popular product gets thousands of reviews?
3. How does document growth affect read and write performance?

---

## 8. Avoiding Unbounded Arrays

### Concept

An unbounded array is an array that can grow without a predictable upper limit.

Examples that can become unbounded:

- product reviews inside a product document
- product events inside a product document
- support messages inside a ticket, if not controlled
- followers/following lists in social apps

### Bad Design Example

```js
{
  productId: "P000100",
  name: "Phone",
  reviews: [
    { rating: 5, body: "Good" },
    { rating: 4, body: "Nice" }
    // keeps growing forever
  ]
}
```

### Better Design

```js
// products
{
  productId: "P000100",
  name: "Phone",
  reviewCount: 2400,
  rating: 4.5
}

// reviews
{
  productId: "P000100",
  rating: 5,
  body: "Good"
}
```

### Exercise 18: Review Query

Create index:

```js
db.reviews.createIndex({ productId: 1, createdAt: -1 })
```

Query latest reviews:

```js
db.reviews.find({
  productId: "P000100"
}).sort({ createdAt: -1 }).limit(10).explain("executionStats")
```

Reflection:

1. Why is this better than embedding all reviews inside product?
2. What index supports this query?
3. What summary fields can still be kept in `products`?

---

## 9. Schema Design Patterns Overview

MongoDB schema patterns are reusable modeling strategies.

This session covers:

| Pattern | Purpose |
|---|---|
| Attribute Pattern | Store variable attributes consistently |
| Bucket Pattern | Group many events/readings into bounded buckets |
| Subset Pattern | Store frequently used subset with parent document |
| Outlier Pattern | Handle exceptional documents separately |

---

## 10. Attribute Pattern

### Concept

The Attribute Pattern is useful when documents have different sets of attributes.

In `products`, attributes are stored like this:

```js
attributes: [
  { name: "color", value: "black" },
  { name: "storage", value: "128GB" }
]
```

This helps model category-specific fields without creating many sparse fields.

### Exercise 19: Query Attributes

Create index:

```js
db.products.createIndex({ "attributes.name": 1, "attributes.value": 1 })
```

Find products with a specific attribute:

```js
db.products.find({
  attributes: {
    $elemMatch: {
      name: "color",
      value: "black"
    }
  }
}).limit(10)
```

Explain:

```js
db.products.find({
  attributes: {
    $elemMatch: {
      name: "color",
      value: "black"
    }
  }
}).explain("executionStats")
```

Reflection:

1. Why does Attribute Pattern help with variable product specifications?
2. What is the trade-off compared to fixed fields like `color`, `storage`, `size`?
3. Why is `$elemMatch` important here?

---

## 11. Bucket Pattern

### Concept

The Bucket Pattern groups many related events into bounded documents.

Useful for:

- logs
- sensor readings
- product events
- time-series-like activity

Current raw event document:

```js
db.product_events.findOne()
```

Possible bucketed design:

```js
{
  productId: "P000100",
  bucketDate: ISODate("2026-05-01"),
  eventCount: 120,
  events: [
    { eventType: "product_view", occurredAt: ISODate("...") },
    { eventType: "add_to_cart", occurredAt: ISODate("...") }
  ]
}
```

### Exercise 20: Understand Event Volume

Find high-volume products:

```js
db.product_events.aggregate([
  { $group: { _id: "$productId", eventCount: { $sum: 1 } } },
  { $sort: { eventCount: -1 } },
  { $limit: 10 }
])
```

Find event volume by date:

```js
db.product_events.aggregate([
  {
    $group: {
      _id: {
        year: { $year: "$occurredAt" },
        month: { $month: "$occurredAt" },
        day: { $dayOfMonth: "$occurredAt" }
      },
      count: { $sum: 1 }
    }
  },
  { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  { $limit: 10 }
])
```

Reflection:

1. Why might raw event documents become expensive at large scale?
2. When would bucketed documents help?
3. What should define a bucket: product, time, session, or something else?

---

## 12. Subset Pattern

### Concept

The Subset Pattern stores frequently needed child data with the parent, while keeping the full data separately.

Example:

A product page may need only the latest 3 reviews, not all reviews.

Possible product document:

```js
{
  productId: "P000100",
  name: "Product Name",
  rating: 4.5,
  reviewCount: 2400,
  recentReviews: [
    { rating: 5, title: "Great", createdAt: ISODate("...") },
    { rating: 4, title: "Good", createdAt: ISODate("...") }
  ]
}
```

Full reviews remain in `reviews`.

### Exercise 21: Build a Review Subset

Find latest 3 approved reviews for a product:

```js
db.reviews.find(
  { productId: "P000100", status: "approved" },
  { _id: 0, rating: 1, title: 1, createdAt: 1 }
).sort({ createdAt: -1 }).limit(3)
```

Reflection:

1. Why might this subset be embedded in the product document?
2. Why should all reviews still remain in the `reviews` collection?
3. What update complexity does this introduce?

---

## 13. Outlier Pattern

### Concept

The Outlier Pattern handles exceptional cases separately, so the common case stays simple and fast.

Example:

Most products may have a manageable number of events or reviews. A few viral products may have extremely high activity.

Instead of designing every product for the extreme case, handle outliers separately.

Possible design:

```js
// products
{
  productId: "P000100",
  name: "Popular Product",
  hasReviewOutlier: true
}

// product_review_outliers
{
  productId: "P000100",
  reviewArchiveRef: "..."
}
```

### Exercise 22: Identify Outliers

Find products with unusually high review counts:

```js
db.reviews.aggregate([
  { $group: { _id: "$productId", reviewCount: { $sum: 1 } } },
  { $sort: { reviewCount: -1 } },
  { $limit: 10 }
])
```

Find products with unusually high event counts:

```js
db.product_events.aggregate([
  { $group: { _id: "$productId", eventCount: { $sum: 1 } } },
  { $sort: { eventCount: -1 } },
  { $limit: 10 }
])
```

Reflection:

1. What makes a document or entity an outlier?
2. Why should outliers not dictate the entire schema?
3. How can outliers be handled separately?

---

## 14. Using Projections Effectively

### Concept

Projection is a schema and query design tool.

Even if a document contains many fields, not every query needs all fields.

Example:

```js
db.products.find(
  { category: "electronics" },
  { _id: 0, productId: 1, name: 1, salePrice: 1, rating: 1 }
).limit(20)
```

### Exercise 23: Product Listing Projection

For a product listing page, run:

```js
db.products.find(
  { category: "electronics", status: "active" },
  {
    _id: 0,
    productId: 1,
    name: 1,
    salePrice: 1,
    rating: 1,
    reviewCount: 1,
    "stock.status": 1
  }
).sort({ salePrice: 1 }).limit(20)
```

Reflection:

1. Which fields are needed for a listing page?
2. Which fields are not needed?
3. Why should large fields be avoided in list views?

---

## 15. Designing for Sharding

### Concept

Sharding distributes data across multiple shards.

Schema design affects sharding because the shard key controls distribution and query routing.

Good shard key qualities:

- high cardinality
- good distribution
- appears in important queries
- avoids write hotspots

Possible shard key discussion examples:

| Collection | Candidate Field | Discussion |
|---|---|---|
| `orders` | `userId` | Good for user order history, but may create uneven users |
| `product_events` | `productId` hashed | Useful for distribution, less useful for range by product/date |
| `support_tickets` | `department` | Low cardinality, poor distribution |
| `users` | `userId` | High cardinality |

### Exercise 24: Evaluate Shard Key Candidates

For each field, discuss whether it has high or low cardinality.

```js
db.orders.distinct("status").length
db.orders.distinct("userId").length
db.product_events.distinct("eventType").length
db.product_events.distinct("productId").length
db.support_tickets.distinct("department").length
db.support_tickets.distinct("userId").length
```

Reflection:

1. Which fields are poor shard key candidates?
2. Which fields distribute better?
3. Why is low cardinality dangerous for sharding?
4. Why should shard key choice depend on query patterns?

---

## 16. Schema Versioning

### Concept

Applications evolve. Documents may not all have the same shape forever.

A simple strategy is to include a schema version field.

Example:

```js
{
  productId: "P000100",
  name: "Product Name",
  schemaVersion: 2
}
```

Possible approaches:

| Approach | Meaning |
|---|---|
| Update all documents immediately | Migration upfront |
| Update documents when read/written | Lazy migration |
| Support multiple versions in application code | Backward compatibility |

### Exercise 25: Add Schema Version to Sample Documents

Do not update all documents yet. First inspect:

```js
db.products.findOne()
```

Update a few documents:

```js
db.products.updateMany(
  { category: "electronics" },
  { $set: { schemaVersion: 1 } }
)
```

Check:

```js
db.products.find(
  { category: "electronics" },
  { productId: 1, category: 1, schemaVersion: 1 }
).limit(5)
```

Reflection:

1. Why is schema versioning useful?
2. Should every migration update all documents immediately?
3. What are the risks of supporting multiple schema versions?

---

## 17. Schema Anti-patterns

### Common Anti-patterns

| Anti-pattern | Problem |
|---|---|
| Embedding unbounded arrays | Document growth and performance issues |
| Over-normalizing everything | Too many lookups and round trips |
| Duplicating too much data | Consistency and update complexity |
| Ignoring query patterns | Poor read performance |
| Designing only like relational tables | Misses document-model benefits |
| Creating very large documents | More memory, network, and update cost |
| Poor shard key choice | Uneven distribution and hotspots |

### Exercise 26: Diagnose Schema Problems

Review these designs and identify the problem.

#### Design A

```js
{
  productId: "P000100",
  reviews: [ /* all reviews forever */ ]
}
```

#### Design B

```js
{
  orderId: "O0001000",
  itemIds: ["OI1", "OI2", "OI3"]
}
```

Each item must be fetched separately from another collection.

#### Design C

```js
{
  ticketId: "T0001000",
  department: "orders"
}
```

Shard key chosen: `{ department: 1 }`

Reflection:

1. What is wrong with Design A?
2. What is wrong with Design B?
3. What is wrong with Design C?
4. How would you redesign each one?

---

# Session 2 Checkpoint

Participants should now be able to:

- design schemas based on query patterns
- decide when to embed and when to reference
- model 1-1, 1-N, and N-N relationships
- avoid unbounded arrays
- explain data duplication trade-offs
- use Attribute, Bucket, Subset, and Outlier patterns
- think about document growth
- design with sharding readiness in mind
- recognize common schema anti-patterns

---

# Suggested Cleanup Commands

Use these only if you want to reset indexes before re-running labs.

```js
db.users.dropIndexes()
db.products.dropIndexes()
db.orders.dropIndexes()
db.reviews.dropIndexes()
db.inventory.dropIndexes()
db.support_tickets.dropIndexes()
db.product_events.dropIndexes()
```

The default `_id` index will not be removed.

---

# Suggested Index Reference

Use these gradually during labs, not all at once.

## Users

```js
db.users.createIndex({ email: 1 })
db.users.createIndex({ status: 1, createdAt: -1 })
db.users.createIndex({ "address.city": 1, segment: 1 })
db.users.createIndex({ status: 1, email: 1, userId: 1 })
```

## Products

```js
db.products.createIndex({ category: 1 })
db.products.createIndex({ category: 1, price: 1 })
db.products.createIndex({ category: 1, rating: -1 })
db.products.createIndex({ tags: 1 })
db.products.createIndex({ "attributes.name": 1, "attributes.value": 1 })
db.products.createIndex({ name: "text", description: "text", tags: "text" })
```

## Orders

```js
db.orders.createIndex({ userId: 1, createdAt: -1 })
db.orders.createIndex({ status: 1, createdAt: -1 })
db.orders.createIndex({ status: 1, createdAt: -1, totalAmount: 1 })
db.orders.createIndex({ "items.productId": 1 })
```

## Reviews

```js
db.reviews.createIndex({ productId: 1, createdAt: -1 })
db.reviews.createIndex({ productId: 1, rating: -1 })
db.reviews.createIndex({ userId: 1, createdAt: -1 })
db.reviews.createIndex({ title: "text", body: "text", tags: "text" })
```

## Inventory

```js
db.inventory.createIndex({ productId: 1, "warehouse.warehouseId": 1 }, { unique: true })
db.inventory.createIndex({ "warehouse.city": 1, "stock.status": 1 })
db.inventory.createIndex({ category: 1, "stock.status": 1 })
db.inventory.createIndex({ "supplier.name": 1, lastRestockedAt: -1 })
```

## Support Tickets

```js
db.support_tickets.createIndex({ status: 1, createdAt: -1 })
db.support_tickets.createIndex({ priority: 1, status: 1, createdAt: -1 })
db.support_tickets.createIndex({ issueType: 1, status: 1 })
db.support_tickets.createIndex({ subject: "text", description: "text", tags: "text" })
```

## Product Events

```js
db.product_events.createIndex({ productId: 1, occurredAt: -1 })
db.product_events.createIndex({ eventType: 1, occurredAt: -1 })
db.product_events.createIndex({ category: 1, eventType: 1, occurredAt: -1 })
db.product_events.createIndex({ userId: 1, occurredAt: -1 })
db.product_events.createIndex({ sessionId: "hashed" })
db.product_events.createIndex({ productId: "hashed" })
```
