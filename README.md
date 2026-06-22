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

## 1. Import dataset
- Unzip `supplied-files/datasets.zip` file
- If importing to an Atlas cluster, set the `MONGOSH_URI` environment variable to your MongoDB Atlas connection string before running the script. No special setup is needed for local MongoDB running on the standar port 27017.
- Linux/Mac
```bash
export MONGOSH_URI="mongodb+srv://<username>:<password>@<cluster-url>"
```
- Windows
```cmd
setx MONGOSH_URI mongodb+srv://<username>:<password>@<cluster-url>
```
- Make sure you have the `mongoimport` tool installed and available in your PATH. You can check by running:

```bash
mongoimport --version
```

- Import the datasets into MongoDB Atlas. From the supplied files folder in the terminal, run
- Linux/Mac
```bash
./import-datasets.sh
```
- For Windows
```cmd
.\import-datasets.bat
```

## 2. Start MongoDB Shell

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

## 3. Verify Document Counts

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

## 4. Check Existing Indexes

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

In **mongosh helper methods**, these are basically **verbosity levels**.

| Mode                            | What it tells you                                           | Does query actually run? | Main use                                                 |
| ------------------------------- | ----------------------------------------------------------- | -----------------------: | -------------------------------------------------------- |
| `.explain()`                    | Same as `.explain("queryPlanner")`                          |        No full execution | See chosen plan                                          |
| `.explain("queryPlanner")`      | Winning plan, rejected plans, index choice, COLLSCAN/IXSCAN |        No full execution | “Which plan/index will MongoDB use?”                     |
| `.explain("executionStats")`    | `queryPlanner` + actual stats for winning plan              |   Yes, winning plan runs | “How many docs/keys were scanned? How long did it take?” |
| `.explain("allPlansExecution")` | `executionStats` + partial stats for competing plans        |                      Yes | “Why did MongoDB choose this plan over others?”          |

Most common fields to check:

```js
// queryPlanner
winningPlan
rejectedPlans
stage: "COLLSCAN" or "IXSCAN"

// executionStats
nReturned
totalDocsExamined
totalKeysExamined
executionTimeMillis
```

Rule of thumb:

```text
queryPlanner       → Which plan?
executionStats     → How good was the chosen plan?
allPlansExecution  → Why this plan over other possible plans?
```

Note: for `db.collection.explain()` and `cursor.explain()`, default is `"queryPlanner"`; for the lower-level `explain` database command, MongoDB docs say default verbosity is `"allPlansExecution"`. ([MongoDB][1])

[1]: https://www.mongodb.com/docs/manual/reference/method/db.collection.explain/ "db.collection.explain() (mongosh method) - Database Manual - MongoDB Docs".  

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

Find an existing email (_we know_ email is unique so only 1 document with a given email is selected)

```js
db.users.findOne({}, { email: 1 })
```

Then use it like

```js
db.users
  .find({ email: "<paste-email-here>" })
  .explain("executionStats")
```

or

```js
db.users
  .find({ email: "<paste-email-here>" })
  .limit(1)
  .explain("executionStats")
```

**NOTE**: You **cannot chain `.explain()` after `findOne()`** because it returns a single document, not a cursor. `.explain()` works on a **cursor**. You must use `find().limit(1)` instead.

#### Query C: City and segment

```js
db.users.find({
  "address.city": "Bengaluru",
  segment: "premium"
}).explain("executionStats")
```

### What Selectivity Means

Selectivity means how much a filter condition reduces the candidate set.

```text
selectivity ≈ matching documents / total documents
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

### Takeaway 
High selectivity does **not** automatically mean fast. Without an index, MongoDB still has to scan documents to find matches.

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

### Notes
Although `status` is low cardinality, and an index only on `status` is not helpful in general, specfic values for status still yield high selectivity - for example, `{ status: "inactive" }` or `{ status : "blocked" }`. So an index on `status` can still be useful for queries that filter on specific values, even if the overall cardinality of the field is low.

Why might `{ status: 1, createdAt: -1 }` be more useful than `{ status: 1 }`?

Because real application queries often filter and sort together.

Example:

```js
db.users.find({ status: "active" })
  .sort({ createdAt: -1 })
  .limit(20)
```

With this index:

```js
db.users.createIndex({ status: 1, createdAt: -1 })
```

MongoDB can:

1. find users by `status`
2. read them already sorted by `createdAt`
3. stop early because of `limit(20)`

So the compound index supports a **real query pattern**, not just a filter.

### Takeaway

**Cardinality tells you how many distinct values a field has. Selectivity tells you how much a query condition reduces the result set.**

A field can have low cardinality and still sometimes be useful, but low-cardinality indexes alone are often weak. Better indexes usually combine fields to match real query patterns, such as:

```js
{ status: 1, createdAt: -1 }
```

instead of only:

```js
{ status: 1 }
```

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

**NOTE**: `createIndexes()` can create multiple indexes.

### What happens internally when you create an index?

When you run:

```js
db.products.createIndex({ category: 1 })
```

MongoDB scans existing documents and builds an ordered index structure containing roughly such entries:

```text
category value -> pointer/reference to document
```

Simplified example:

```text
clothing    -> doc 532
clothing    -> doc 678
electronics -> doc 101
electronics -> doc 205
electronics -> doc 333
furniture   -> doc 245
furniture   -> doc 412
```

Then future queries can search the index instead of the full collection.

But this has a cost. Indexes use RAM + disk.

```text
Reads can become faster
Writes become slightly slower
Storage usage increases
```

Because every insert/update/delete may also need to update indexes.

---

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

### Takeaway

An index does not always mean the query is fully optimized.

When MongoDB uses an index, it may still need a `FETCH` stage to read the actual documents from the collection. This happens when the index helps find matching documents, but does not contain everything needed to return the result.

```text
Was there an IXSCAN?
Was there still a FETCH?
How many keys were examined?
How many documents were examined?
Was the query covered by the index?
```

The best case is often a __covered query__, where MongoDB can answer directly from the index without FETCH.

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

**Self-exploration**: MongoDB allows you to filter indexed queries by using the `hint()` method. For example, if you have multiple indexes and want to force MongoDB to use a specific index, you can do:

```js
db.users.find({ email: "<paste-email-here>" }).hint({ email: 1 }).explain("executionStats")
```

Additionally, you can force an index filter for query shapes using `planCacheSetFilter()`. This is more advanced and can be used to influence the query planner's choice of index for specific queries. However MongoDB 8.0 deprecates index filters in favor of query settings (`hint()`) - index filters are not persistent and are not easy to create across all cluster nodes.

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
What are the execution stage(s) now? What are the estimate(s) execution time(s) for the stages?  


Now, create index:

```js
db.orders.createIndex({ userId: 1, createdAt: -1 })
```

Run again:

```js
db.orders.find({
  userId: "U000100"
}).sort({ createdAt: -1 }).explain("executionStats")
```

What are the execution stage(s) now? What are the estimate(s) execution time(s) for the stages?  

Try this

```js
db.orders.find().sort({ createdAt: -1 }).explain("executionStats")
```

Try this as well

```js
db.orders.find({ createdAt: { $gte:ISODate("2026-01-01") } }).explain("executionStats")
```

Reflection:

1. Did the query avoid in-memory sort?
2. Did `totalDocsExamined` reduce?
3. Why does field order matter in a compound index?

You know from the winning plan, if there was an in-memory sort - the plan will contain a SORT stage.

This compound index:

```js
{ userId: 1, createdAt: -1 }
```

is useful when queries use `userId` first, optionally with sorting/range on `createdAt`.

Useful queries:

```js
db.orders.find({ userId: 101 })
```

Good: uses the leftmost field `userId`.

```js
db.orders.find({ userId: 101 })
  .sort({ createdAt: -1 })
```

Very good: find one user’s records, newest first.

```js
db.orders.find({
  userId: 101,
  createdAt: { $gte: ISODate("2026-01-01") }
})
```

Good: filter by user, then date range.

```js
db.orders.find({
  userId: 101,
  createdAt: { $gte: ISODate("2026-01-01") }
}).sort({ createdAt: -1 })
```

Very good: one user’s recent records, newest first.

Less useful:

```js
db.orders.find({ createdAt: { $gte: ISODate("2026-01-01") } })
```

Because `createdAt` is not the leftmost field.

---

## General principle

For a compound index:

```js
{ fieldA: 1, fieldB: -1 }
```

MongoDB can use it best when the query starts with `fieldA`.

Think:

```text
Equality/filter on first field,
then sort or range on later fields.
```

So:

```text
{ userId: 1, createdAt: -1 }
```

matches the pattern:

```text
For one user, quickly find records in createdAt order.
```

__NOTE__: We generalize this principle as the **ESR rule** (Equality, Sort, Range) in a later section.

**Aside**:
- A simple query often uses one index.
- An $or query may use one index per branch and an AND query may sometimes use index intersection. __Thus multiple indexes can be used for a single query.__

### Using a compound indexes in place of multiple single-field indexes
- A well-designed compound index is usually preferred for common query patterns over multiple single-field indexes, even if MongoDB can combine them using index intersection.

Suppose you create separate indexes:

```js
db.users.createIndex({ status: 1 })
db.users.createIndex({ "address.city": 1 })
```

Query:

```js
db.users.find({
  status: "active",
  "address.city": "Mumbai"
}).explain("executionStats")
```

MongoDB **may** use index intersection:

```text
FETCH
  AND_SORTED / AND_HASH
    IXSCAN status_1
    IXSCAN address.city_1
```

Meaning:

```text
Find active users using status_1
Find Mumbai users using address.city_1
Intersect both sets
Fetch matching documents
```

But for this common query pattern, a compound index is usually better:

```js
db.users.createIndex({
  status: 1,
  "address.city": 1
})
```

Then the query can use one focused index:

```text
FETCH
  IXSCAN status_1_address.city_1
```

```text
Separate indexes can sometimes be combined.
But if status + city is a frequent filter, create one compound index for that shape.
```

---

### Index direction

Index direction matters mainly for **sorts**, especially **compound indexes**.

#### 1. Single-field index

```js
db.products.createIndex({ price: 1 })
```

This can support both:

```js
db.products.find().sort({ price: 1 })
db.products.find().sort({ price: -1 })
```

MongoDB can scan the index:

```text
forward  -> ascending
backward -> descending
```

So for a **single field**, `1` vs `-1` usually does not matter much.

#### 2. Compound index with same direction

```js
db.orders.createIndex({ customerId: 1, createdAt: -1 })
```

Good for:

```js
db.orders.find({ customerId: 101 })
  .sort({ createdAt: -1 })
```

Because for each `customerId`, documents are already arranged newest-first.

Also works by reverse scan for:

```js
db.orders.find({ customerId: 101 })
  .sort({ createdAt: 1 })
```

Because `customerId` is fixed by equality.

#### 3. Compound index with multiple sort fields

This is where direction really matters.

Index:

```js
db.products.createIndex({ category: 1, price: 1, rating: -1 })
```

Supports this sort:

```js
db.products.find({ category: "electronics" })
  .sort({ price: 1, rating: -1 })
```

Also supports the exact reverse:

```js
db.products.find({ category: "electronics" })
  .sort({ price: -1, rating: 1 })
```

But it does **not** naturally support:

```js
db.products.find({ category: "electronics" })
  .sort({ price: 1, rating: 1 })
```

Because the relative direction between `price` and `rating` does not match.

### Takeaway
- Multiple indexes can be used for a single query, but a well-designed compound index is usually preferred for common query patterns.
- Direction barely matters for equality lookups.
- Direction usually does not matter for single-field sorts.
- _Direction matters for compound indexes with multiple sort fields_. Use index direction to match how the application sorts results. __Especially care when the sort uses more than one field__.

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

### Multikey indexes are created differently

For normal field:

```js
{ name: "A", email: "a@test.com" }
```

Index on:

```js
db.users.createIndex({ email: 1 })
```

creates roughly:

```text
a@test.com -> document reference
```

But for an array field:

```js
{
  name: "A",
  tags: ["best-seller", "budget", "discounted"]
}
```

Index on:

```js
db.users.createIndex({ tags: 1 })
```

creates multiple index entries for the same document:

```text
best-seller -> doc A
budget  -> doc A
discounted -> doc A
best-seller -> doc B
eco-friendly -> doc B
...
```

That is a **multikey index**. MongoDB automatically makes the index multikey when the indexed field contains arrays.

### How does it show in `explain()`?

You may see:

```js
isMultiKey: true,
multiKeyPaths: {
  tags: ["tags"]
}
```

Meaning:

```text
This index became multikey because tags is an array field.
```

For scalar (non-array) fields like `email`:

```js
isMultiKey: false,
multiKeyPaths: {
  email: []
}
```

This means
```text
The index is not multikey.
For the email field, no array path caused multikey behavior.
```

One document can produce many index entries. So these can happen.

```text
more index entries
larger index
more write overhead
possible duplicate index matches for same document
some compound-index limitations
some sort/coverage limitations
```

Example:

```js
db.products.createIndex({ tags: 1 })
```

Query:

```js
db.products.find({ tags: "electronics" })
```

This is useful because MongoDB can quickly find documents where `tags` contains `"electronics"`.

But the index may be larger than expected because each array element is indexed.

### Compound multikey issue

Suppose:

```js
{
  tags: ["electronics", "sale"],
  colors: ["red", "black"]
}
```

You generally cannot create a compound multikey index where **more than one indexed field is an array** in the same document.

```js
db.products.createIndex({ tags: 1, colors: 1 })
```

This is __not allowed as a single document has arrays in more than one indexed field__ (`MongoServerError[CannotIndexParallelArrays]`)

Why? It could create combinations like:

```text
electronics + red
electronics + black
sale + red
sale + black
```

This can explode index entries.  

When an index is created, you should ask:

```text
Is this field an array?
How many values can each document have?
Is the index becoming large?
```

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

You can have only one text index per collection, but it can cover multiple fields. The text index will tokenize and index the string content of those fields to support efficient text search queries.  
  

Run:

```js
db.products.find({
  $text: { $search: "smart premium" }
})
```

This will search for documents where the indexed text fields contain the words "smart" and "premium" (can appear across fields).  

Project text score:

```js
db.products.find(
  { $text: { $search: "smart premium" } },
  { score: { $meta: "textScore" }, name: 1, category: 1 }
).sort({ score: { $meta: "textScore" } })
```

Sort based on text score:
```js
db.products.find(
  { $text: { $search: "smart premium" } },
  { score: { $meta: "textScore" }, name: 1, category: 1 }
).sort({
  score: { $meta: "textScore" }
})
```

### Reflection

1. Why is a text index different from a normal ascending index?
2. What types of search problems can text indexes help with?
3. When would a text index not be enough?

A normal ascending index stores field values in sorted order. It indexes whole field values. A text index, on the other hand, tokenizes string content and creates an index of those tokens to support efficient text search queries. A query using it searches for words inside text fields, not exact full values.

### When would a text index not be enough?

A MongoDB text index is basic full-text search.

It may not be enough for:

```text
autocomplete / search-as-you-type
typo tolerance / fuzzy search
advanced ranking
synonyms
facets and filters like ecommerce search
semantic/vector search
language-specific advanced analysis
highlighting matched terms
complex relevance tuning
```

Example: if user searches:

```text
iphne
```

and expects:

```text
iphone
```

a basic text index may not handle that well.

For advanced search, use Atlas Search or a dedicated search engine.

### Self-exploration
- MongoDB text indexes support basic language-aware search - this affects tokenization, stemming, stop words.
- The default language is English, but you can specify other languages when creating the index.
- Per-document language can be specified with a `language` field. This can help with multilingual search, but it is not as powerful as a dedicated multilingual search engine.

### Takeaway
- A normal index helps MongoDB find exact values, ranges, and sorted results.
- A text index helps MongoDB search for words inside text fields and rank matches using `textScore`.
- Use text indexes for basic keyword search. Use __Atlas Search__, __Elasticsearch__ or another search engine when you need autocomplete, typo tolerance, advanced ranking, or semantic search.

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

Query:

```js
db.product_events.find({
  sessionId: { $gt: "S0001000", $lt: "S0002000" }
}).explain("executionStats")
```

### Reflection

1. Why are hashed indexes useful for equality matches?
2. Are hashed indexes useful for range queries?
3. Why might hashed indexes distribute writes more evenly?

### Takeaway
- Hashed index is useful for equality lookups but not for range queries. They are more efficient for equality matches because the hash function distributes values uniformly, which can lead to better performance for queries that look for specific values. 
- However, hashed indexes do not maintain any order of the original field values, so they cannot efficiently support range queries.
- Additionally, hashed indexes can help distribute writes more evenly across shards in a sharded cluster, as the hash function can spread values across the key space.

---

## 6.6 Unique Index

```js
db.users.createIndex(
  { email: 1 },
  { unique: true }
)
```

This enforces uniqueness.

Now MongoDB rejects duplicates:

```js
db.users.insertOne({ email: "john@example.com" })
db.users.insertOne({ email: "john@example.com" }) // error
```

Use it for fields like:

```text
email
username
employeeId
orderNumber
```

MongoDB documents the `unique` option as making the collection reject inserts or updates where the indexed key matches an existing value.

Important: if duplicate values already exist, creating the unique index fails.

---

## 6.7 Partial Index

A partial index indexes only documents matching a condition.

```js
db.users.createIndex(
  { email: 1 },
  {
    partialFilterExpression: {
      status: "active"
    }
  }
)
```

Only active users are indexed.

Useful when most queries are like:

```js
db.users.find({
  status: "active",
  email: "john@example.com"
})
```

This saves index size and write overhead.

MongoDB describes partial indexes as a way to index only documents that meet a specified filter condition.

Today, partial indexes are often preferred over sparse indexes (left for self-exploration) for __indexing documents in a collections with missing or optional fields__ because they are more explicit:

```js
db.users.createIndex(
  { phone: 1 },
  {
    partialFilterExpression: {
      phone: { $exists: true }
    }
  }
)
```

---

## 6.8 Other Index Types
These are some other index types that are less common and left for self-exploration
- _Wildcard index_ - Useful when documents have unpredictable fields
- _Geospatial index_ - Used for location-based queries
- _TTL index_ - Used for expiring documents after a certain period
- _Sparse index_ - Indexes only documents that contain the indexed field (partial indexes are often preferred today)
- _Hidden index_ - Index exists but is ignored by the query planner (useful for testing or deprecating indexes). It is preferable to hide an index rather than drop it, because dropping an index can be expensive and time-consuming on large collections. Hiding allows you to test the impact of removing an index without actually deleting it.
- _Collation index_ - Used for language/case-insensitive comparisons

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

Run:

```js
db.users.find(
  { status: "active" },
  { _id: 0, email: 1, userId: 1 }
).explain("executionStats")
```

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

Run with `_id` included:

```js
db.users.find(
  { status: "active" },
  { _id: 1, email: 1, userId: 1 }
).explain("executionStats")
```

### Expected Observation

For the covered query you will see `PROJECTION_COVERED`, and `totalDocsExamined` should be `0`. Else it will be `PROJECTION_SIMPLE` and `totalDocsExamined` will be greater than `0`. `totalKeysExamined` should be same in last 2 cases.

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
2. What about `totalKeysExamined` and `totalDocsExamined`? Did MongoDB need to scan fewer keys?
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
2. Does projection reduce the time to serialize documents?
3. Does projection reduce network payload?
4. Does projection reduce network latency?
5. Does projection reduce client-side processing time?
6. Why is projection useful even if it does not always change the query plan?

Network latency reduces when projection is used (this is not included in the `executionTimeMillis` as that is the server time; it only measures the time to build result documents and serialize BSON). However the time to serialize also reduces when projection is used, because the server has to serialize fewer fields. This can be significant for large documents.

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

Add this index if it does not exist:

```js
db.products.createIndex({ category: 1 })
```

Run again:

```js
db.products.find({
  category: "electronics"
}).sort({ price: 1 }).explain("executionStats")
```

Reflection:

1. Did the plan contain a `SORT` stage before the index?
2. Any rejected plans? If so, why?
3. Did the index remove or reduce sorting work?
4. Why is `{ category: 1, price: 1 }` better than `{ price: 1, category: 1 }` for this query?
5. Why is `{ category: 1, price: 1 }` better than `{ category: 1 }` for this query? Is the latter even needed?

- Use ESR rule to reason about compound index field order. We are not interested in comparing prices across different categories. We are interested in comparing prices within the same category. The query filters on `category` and sorts on `price`. So the index should have `category` first, then `price`. This allows MongoDB to find documents by category and read them already sorted by price, avoiding an in-memory sort.

- A index with a prefix of fields in another index, like `{ category: 1 }`, is not usually needed if the compound index already covers the query.

---

## 12. Index Maintenance and Trade-offs

### Concept

Indexes improve read performance but have costs. When you insert/update/delete a document, MongoDB makes changes to the relevant indexes to keep them in sync with their collection!

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

### When might keeping the smaller index still be useful?

Keep the smaller index if `category`-only queries are very frequent and performance-sensitive.

A smaller index can be useful because it is:

```text
smaller on disk
lighter in memory
faster to scan
cheaper for simple category-only lookups
```

For example:

```js
db.products.find({ category: "electronics" })
```

may be slightly cheaper with:

```js
{ category: 1 }
```

than with:

```js
{ category: 1, price: 1, rating: -1 }
```

because the larger index has more data per entry.

### Practical takeaway

Do not blindly delete smaller prefix indexes.

Usually:

```js
{ category: 1 }
```

is redundant if you already have:

```js
{ category: 1, price: 1 }
```

But keep it if measurements show it is useful for a major query pattern.

Confirm using:

```js
db.products.find({ category: "electronics" })
  .explain("executionStats")
```

and compare with `.hint()`:

```js
.hint({ category: 1 })

.hint({ category: 1, price: 1 })

.hint({ category: 1, price: 1, rating: -1 })
```

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

## Session 1 End-of-Session Lab: Diagnose and Index Real Query Patterns

**Time:** 15 minutes  
**Goal:** Look at short application scenarios, decide the right index or identify why the query is slow.

Work in pairs. Do not create duplicate indexes blindly. First check existing indexes, then decide whether a new index is needed.

```js
db.products.getIndexes()
db.orders.getIndexes()
db.support_tickets.getIndexes()
```

### Scenario A: Product Listing Page

The application shows active electronics products sorted by lowest sale price. Only listing fields are needed.

```js
db.products.find(
  { category: "electronics", status: "active" },
  { _id: 0, productId: 1, name: 1, salePrice: 1, rating: 1 }
).sort({ salePrice: 1 }).limit(20).explain("executionStats")
```

Tasks:

1. Identify whether the query uses `COLLSCAN`, `IXSCAN`, `FETCH`, or `SORT`.
2. Create a suitable compound index if needed.
3. Explain why the field order is suitable.

Suggested thinking:

```text
Equality fields first, sort field next.
```

### Scenario B: Customer Order History

The application shows the latest delivered orders for one user.

```js
db.orders.find({
  userId: "U000100",
  status: "delivered"
}).sort({ createdAt: -1 }).limit(10).explain("executionStats")
```

Tasks:

1. Decide whether the current indexes support this query well.
2. Create an index if needed.
3. Check whether the query avoids an in-memory `SORT`.

### Scenario C: Support Dashboard Performance Issue

Support agents frequently open a dashboard that shows urgent open tickets first.

```js
db.support_tickets.find({
  status: "open",
  priority: "high"
}).sort({ createdAt: -1 }).limit(20).explain("executionStats")
```

Tasks:

1. Identify the performance problem from `explain("executionStats")`.
2. Create a suitable index.
3. Rerun the query and compare `totalDocsExamined`, `totalKeysExamined`, and the winning plan.

### Scenario D: Search Query Problem

A developer wrote this query for product search:

```js
db.products.find({
  name: /smart/i
}).explain("executionStats")
```

Tasks:

1. Identify why this may be slow.
2. Decide whether a normal ascending index is enough.
3. Suggest a better search approach for keyword search.

### Lab Output

Fill this table:

| Scenario | Problem Observed | Index / Fix Suggested | Why This Helps |
|---|---|---|---|
| A | | | |
| B | | | |
| C | | | |
| D | | | |

### Takeaway

Index design starts from real query patterns. A good index should support the filter, sort, projection, and limit used by the application.

---

## Session 1 Practice Questions

### Q1. A collection has 5 million documents. A query filters on a field that has no index. What is the most likely execution behavior?

A. MongoDB scans all or many collection documents
B. MongoDB scans only matching index entries
C. MongoDB skips query planning entirely
D. MongoDB automatically creates an index

### Q2. Which `explain()` mode is most useful when you want actual values such as documents examined, keys examined, and number of documents returned?

A. `queryPlanner`
B. `executionStats`
C. `indexOnly`
D. `schemaStats`

### Q3. A query on `email` returns one document from a million users, while a query on `status` returns 600,000 documents. Which statement is most accurate?

A. `status` is more selective than `email`
B. Both fields have equal selectivity
C. `email` is more selective than `status`
D. Selectivity only depends on index size

### Q4. An application frequently runs: find invoices for one customer, sorted by invoice date descending. Which index is generally best?

A. `{ invoiceDate: -1, customerId: 1 }`
B. `{ amount: 1, customerId: 1 }`
C. `{ invoiceDate: 1, amount: 1 }`
D. `{ customerId: 1, invoiceDate: -1 }`

### Q5. A `posts` collection has a `tags` array. An index is created on `{ tags: 1 }`. Why is this called a multikey index?

A. It indexes multiple collections together
B. One array document can create multiple index entries
C. It requires multiple shard keys
D. It stores multiple indexes in memory only

### Q6. A blog platform needs basic keyword search across `title` and `body`. Which index type is most appropriate?

A. Hashed index
B. TTL index
C. Text index
D. Unique index

### Q7. A collection stores activity events by `sessionId`. Queries usually search for one exact `sessionId`. Which index can help equality lookup and shard distribution?

A. `{ sessionId: "text" }`
B. `{ sessionId: -1, time: 1 }` only
C. `{ sessionId: "ttl" }`
D. `{ sessionId: "hashed" }`

### Q8. A query filters by `status` and returns only `email`, excluding `_id`. The index contains `status` and `email`. What is the likely benefit?

A. MongoDB must fetch every full document
B. MongoDB ignores the projection
C. MongoDB may answer using only the index
D. MongoDB converts it to text search

### Q9. An API list endpoint needs only `name`, `price`, and `rating`, but documents contain many large fields. Why use projection?

A. To delete unused fields permanently
B. To reduce returned fields and network payload
C. To force a unique index
D. To disable query planning

### Q10. Why should developers avoid creating indexes on every field?

A. Indexes prevent queries from using filters
B. Indexes disable document validation
C. Indexes remove the `_id` field
D. Indexes increase storage and write maintenance cost

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

## Session 2 End-of-Session Lab: Design a Short Application Schema

**Time:** 20 minutes  
**Goal:** Design a MongoDB schema from application requirements using the patterns learned in this session.

### Application: Online Learning Platform

The application supports online courses and live workshops. Users can browse courses, enroll, watch lessons, submit reviews, and track activity.

Main requirements:

1. Users browse active courses by `category`, `level`, `price`, and `rating`.
2. A course detail page shows course information, instructor summary, modules, rating summary, and latest 3 approved reviews.
3. A user profile page shows the user and their latest enrollments.
4. Enrollment history must preserve the course title and price at the time of enrollment.
5. Reviews can grow to thousands per popular course.
6. Lesson activity events can become very high volume.
7. Course specifications vary by category. For example, programming courses have language/framework fields, while design courses have tool/version fields.

### Tasks

#### 1. Identify Collections

List the main collections you would create.

| Collection | Purpose |
|---|---|
| | |
| | |
| | |
| | |

#### 2. Decide Embed vs Reference

| Relationship | Embed or Reference? | Reason |
|---|---|---|
| Course → Modules | | |
| Course → Reviews | | |
| User → Enrollments | | |
| Enrollment → Course Snapshot | | |
| Course → Instructor | | |
| Course → Activity Events | | |

#### 3. Sketch Two Important Documents

Sketch a possible `courses` document and an `enrollments` document. Keep only important fields.

```js
// courses
{

}
```

```js
// enrollments
{

}
```

#### 4. Apply Schema Design Patterns

Identify one place where each idea applies.

| Concept / Pattern | Where would you use it? |
|---|---|
| Avoid unbounded array | |
| Duplicate snapshot data | |
| Attribute Pattern | |
| Subset Pattern | |
| Bucket Pattern | |
| Outlier Pattern | |

#### 5. Suggest Indexes for Two Query Patterns

Choose two important queries and suggest indexes.

| Query Pattern | Suggested Index |
|---|---|
| Browse courses by category and price | |
| Latest enrollments for a user | |

### Lab Output

Each group should be ready to explain:

1. Which data is embedded and why.
2. Which data is referenced and why.
3. Which arrays are bounded and which are avoided.
4. Which fields are duplicated intentionally.
5. Which indexes support the main read patterns.

### Takeaway

A good MongoDB schema is not just a set of collections. It is a design based on query patterns, relationship size, data growth, duplication trade-offs, and future scalability.

---

## Session 2 Practice Questions

### Q1. Before designing MongoDB collections, what should you identify first?

A. Application query patterns
B. Alphabetical field order
C. Number of developers
D. UI color theme

### Q2. A small user preferences object is always displayed with the user profile and updated with the user. Which design is generally suitable?

A. Store preferences in millions of separate collections
B. Use a text index for preferences
C. Embed preferences inside the user document
D. Store preferences only in application memory

### Q3. A news article can receive thousands of comments over time. Which design is usually safer?

A. Embed all comments forever in the article document
B. Store comments in the article title field
C. Use one collection per comment
D. Store comments in a separate collection with article references

### Q4. A customer can place many orders. Orders are queried independently and may grow over time. Which relationship modeling choice is generally better?

A. Embed all orders forever inside customer
B. Store orders separately with customer reference
C. Store customers inside every order item only
D. Avoid storing customer identity

### Q5. An order stores the product name and price at purchase time. Why can this be useful?

A. It prevents all future product updates
B. It removes the need for indexes
C. It preserves historical order details
D. It guarantees product stock availability

### Q6. Which design is most likely to cause document growth problems?

A. Embedding all user activity events forever
B. Embedding one small address object
C. Storing a fixed settings object
D. Keeping a small status field

### Q7. Products in different categories have different specifications. Which pattern helps model variable attributes consistently?

A. Outlier Pattern
B. Bucket Pattern
C. Schema Versioning Pattern
D. Attribute Pattern

### Q8. A system records millions of temperature readings per device per day. Which pattern can group readings into bounded documents?

A. Unique Index Pattern
B. Bucket Pattern
C. Text Search Pattern
D. Over-normalization Pattern

### Q9. A product page usually shows only the latest three reviews, while all reviews remain queryable separately. Which pattern fits this design?

A. Subset Pattern
B. Hashed Pattern
C. Parallel Array Pattern
D. Sparse Document Pattern

### Q10. Which field is usually a poor shard key candidate?

A. A high-cardinality user identifier
B. A low-cardinality field like department
C. A frequently queried customer identifier
D. A well-distributed event identifier

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
