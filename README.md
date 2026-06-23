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

### Option 1: Use the supplied datasets to import into Atlas / local database

- Unzip `supplied-files/datasets.zip` file
- If importing to an Atlas cluster, set the `MONGOSH_URI` environment variable to your MongoDB Atlas connection string before running the script. __No special setup is needed for local MongoDB running on the standar port 27017__ - so skip this step for local setup.
- Make sure you have the `mongoimport` tool installed and available in your PATH. You can check by running:
```bash
mongoimport --version
```

- For __Linux/Mac__
```bash
export MONGOSH_URI="mongodb+srv://<username>:<password>@<cluster-url>"
```
- For __Windows__
```cmd
setx MONGOSH_URI mongodb+srv://<username>:<password>@<cluster-url>
```

- Import the datasets into MongoDB Atlas. From the supplied files folder in the terminal, run

- For __Linux/Mac__
```bash
./import-datasets.sh
```
- For __Windows__
```cmd
.\import-datasets.bat
```

### Option 2: Use the instructor's Atlas cluster to import the datasets to your local MongoDB instance

There is already a set up of the DB on the instructor's Atlas cluster. Ask the instructor for the connection string and replace details in the `mongodump` command below. Then set it up locally using `mongodump` and `mongorestore`.
- Make sure you have the `mongodump` and `mongorestore` tools installed and available in your PATH. You can check by running:
```bash
mongodump --version
mongorestore --version
```

Now run the following commands to dump the database from Atlas and restore it to your local MongoDB instance. ```bash
mongodump \
  --uri="mongodb+srv://<username>:<password>@<cluster-url>/<db-name>" \
  --out=./dump

mongorestore \
  --uri="mongodb://localhost:27017" \
  ./dump
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
- Good catch. The wording should be more precise.

A __normal ascending index with default/simple collation__ helps __case-sensitive equality__, but not __case-insensitive equality__. For case-insensitive equality, create a __collation-aware index__ or store a normalized value such as lowercase text. However, even collation-aware indexes do not improve performance for `$regex` queries, as `$regex` is not collation-aware.

```js
db.products.createIndex({ name: 1 })

db.products.find({ name: "smart" })
```

This can use the `{ name: 1 }` index.

But this query from the lab is **not equality**:

```js
db.products.find({ name: /smart/i })
```

That is a **case-insensitive regex pattern match**. MongoDB docs note that `$regex` is not collation-aware, so case-insensitive indexes do not improve `$regex` performance.

Example with collation:

```js
db.products.createIndex(
  { name: 1 },
  { collation: { locale: "en", strength: 2 } }
)

db.products.find({ name: "smart" })
  .collation({ locale: "en", strength: 2 })
```

That is useful for case-insensitive equality like:

```text
smart == Smart == SMART
```

Common values for `strength`:

| Strength | Meaning                         | Example behavior               |
| -------: | ------------------------------- | ------------------------------ |
|      `1` | Base character comparison       | ignores case and accents       |
|      `2` | Base + accent comparison        | ignores case, respects accents |
|      `3` | Base + accent + case comparison | respects case                  |

So for most case-insensitive equality queries, this is common:

```js
{ locale: "en", strength: 2 }
```

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

**For basic search-like functionality**, a **text index is usually better than regex**.

Example:

```js
db.products.createIndex({
  name: "text",
  description: "text",
  tags: "text"
})
```

Query:

```js
db.products.find({
  $text: { $search: "Pro" }
})
```

### Why text index is better

A text index is useful when you want to search for **words/terms**, such as:

```js
"premium laptop"
"wireless mouse"
"smart phone"
```

It supports:

```text
word-based search
multi-field search
relevance score
language stemming
stop-word handling
```

Example with score:

```js
db.products.find(
  { $text: { $search: "premium smart" } },
  { score: { $meta: "textScore" }, name: 1 }
).sort({
  score: { $meta: "textScore" }
})
```

### But text index is not better for everything

For this kind of search:

```js
{ name: /Pro/ }
```

you are searching for a **substring**. MongoDB text index is **not a general substring search engine**.

So:

```text
"Pro Max"
```

may match `"Pro"` as a word, but:

```text
"Product"
"Professional"
"GoPro"
```

may not behave like `/Pro/`.

### Rule of thumb

| Requirement                                         | Better option                                   |
| --------------------------------------------------- | ----------------------------------------------- |
| Exact match                                         | Normal index                                    |
| Prefix match like `^Pro`                            | Normal index on `name`                          |
| Word-based search                                   | Text index                                      |
| Substring/fuzzy/autocomplete/search engine behavior | Atlas Search / Elasticsearch / Meilisearch etc. |

### Takeaway
Regex matching does not make use of indexes efficiently (may make use of indexes partially sometimes). Use a text index for basic word search, but again, not as a replacement for full search-engine-style features. 

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

### Scenario B: High-value Customer Order History

The application shows the latest delivered high-value orders for one user.

```js
db.orders.find({
  userId: "U000100",
  status: "delivered",
  totalAmount: { $gte: 5000 }
}).sort({ createdAt: -1 }).limit(10).explain("executionStats")
```

Tasks:

1. Identify the equality, sort, and range fields.
2. Create a suitable compound index using the ESR rule.
3. Check whether the query avoids an in-memory `SORT`.

Suggested thinking:

```text
Equality fields first, sort field next, range field last.
```

### Scenario C: Product Tag Filter

The application shows products tagged as best-sellers.

```js
db.products.find({
  tags: "best-seller"
}).limit(20).explain("executionStats")
```

Tasks:

1. Identify whether the query uses `COLLSCAN` or `IXSCAN`.
2. Create a suitable index if needed.
3. Explain why this becomes a multikey index.

Suggested thinking:

```text
Array fields create multikey indexes.
One document can create multiple index entries.
```

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
| -------- | ---------------- | --------------------- | -------------- |
| A        |                  |                       |                |
| B        |                  |                       |                |
| C        |                  |                       |                |
| D        |                  |                       |                |

### Takeaway

Index design starts from real query patterns. A good index should support the filter, sort, projection, and limit used by the application.

---

## Session 1 Practice Questions

### Q1. A collection has 5 million documents. A query filters on a field that has no index. What is the most likely execution behavior?

- A. MongoDB scans all or many collection documents
- B. MongoDB scans only matching index entries
- C. MongoDB skips query planning entirely
- D. MongoDB automatically creates an index

### Q2. Which `explain()` mode is most useful when you want actual values such as documents examined, keys examined, and number of documents returned?

- A. `queryPlanner`
- B. `executionStats`
- C. `indexOnly`
- D. `schemaStats`

### Q3. A query on `email` returns one document from a million users, while a query on `status` returns 600,000 documents. Which statement is most accurate?

- A. `status` is more selective than `email`
- B. Both fields have equal selectivity
- C. `email` is more selective than `status`
- D. Selectivity only depends on index size

### Q4. An application frequently runs: find invoices for one customer, sorted by invoice date descending. Which index is generally best?

- A. `{ invoiceDate: -1, customerId: 1 }`
- B. `{ amount: 1, customerId: 1 }`
- C. `{ invoiceDate: 1, amount: 1 }`
- D. `{ customerId: 1, invoiceDate: -1 }`

### Q5. A `posts` collection has a `tags` array. An index is created on `{ tags: 1 }`. Why is this called a multikey index?

- A. It indexes multiple collections together
- B. One array document can create multiple index entries
- C. It requires multiple shard keys
- D. It stores multiple indexes in memory only

### Q6. A blog platform needs basic keyword search across `title` and `body`. Which index type is most appropriate?

- A. Hashed index
- B. TTL index
- C. Text index
- D. Unique index

### Q7. A collection stores activity events by `sessionId`. Queries usually search for one exact `sessionId`. Which index can help equality lookup and shard distribution?

- A. `{ sessionId: "text" }`
- B. `{ sessionId: -1, time: 1 }` only
- C. `{ sessionId: "ttl" }`
- D. `{ sessionId: "hashed" }`

### Q8. A query filters by `status` and returns only `email`, excluding `_id`. The index contains `status` and `email`. What is the likely benefit?

- A. MongoDB must fetch every full document
- B. MongoDB ignores the projection
- C. MongoDB may answer using only the index
- D. MongoDB converts it to text search

### Q9. An API list endpoint needs only `name`, `price`, and `rating`, but documents contain many large fields. Why use projection?

- A. To delete unused fields permanently
- B. To reduce returned fields and network payload
- C. To force a unique index
- D. To disable query planning

### Q10. Why should developers avoid creating indexes on every field?

- A. Indexes prevent queries from using filters
- B. Indexes disable document validation
- C. Indexes remove the `_id` field
- D. Indexes increase storage and write maintenance cost

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

## Dataset Context

Many examples use an e-commerce dataset.

| Collection | Approx. Records | Purpose |
|---|---:|---|
| [`users`](./datasets/users.ndjson) | 50,000 | Filtering, sorting, selectivity, compound indexes, projections |
| [`products`](./datasets/products.ndjson) | 10,000 | Text indexes, category filters, price/rating indexes, attribute pattern |
| [`categories`](./datasets/categories.ndjson) | 49 | Simple reference data, category hierarchy |
| [`orders`](./datasets/orders.ndjson) | 100,000 | Compound indexes, ESR rule, date-range queries, customer order history |
| `order_items` - embedded order items in `orders` | NA | Schema design: embedding vs referencing, document growth |
| [`reviews`](./datasets/reviews.ndjson) | 100,000 | Multikey-style access patterns, product/user lookups, sort by rating/date |
| [`inventory`](./datasets/inventory.ndjson) | 20,000 | Product-stock lookup, warehouse queries, update-heavy collection |
| [`support_tickets`](./datasets/support_tickets.ndjson) | 25,000 | Text search, status/date filtering, case-study optimization |
| [`product_events`](./datasets/product_events.ndjson) | 100,000 | Bucket pattern demo, high-volume time-series-style events |
| **Total** | **405,049** | |

---

## Consolidation Map: Concepts, Variations, and Example Purpose

| Concept | Example retained | Unique aspect covered |
|---|---|---|
| Query-driven design | Latest 10 orders for a user | Schema fields and index come from the query pattern |
| Read/write frequency | User/account status duplicated in tasks/comments/messages | Current-state data should not be duplicated everywhere |
| Embedding read-together data | Order line items inside `orders` | Data commonly displayed together can be fetched in one query |
| Snapshot duplication | Customer/product snapshot in an order | Historical values are intentionally preserved |
| Avoiding uncontrolled growth | Reviews stored separately from products | Unbounded child data should not grow inside parent documents |
| Query pattern discovery | Product listing, details, orders, reviews, tickets, events | Start schema design from application screens and access paths |
| Embedding vs referencing | Order items vs product reviews | Bounded child data can be embedded; unbounded child data should be referenced |
| One-to-one | User preferences embedded in `users` | Small one-to-one data can live with parent |
| One-to-many | User orders referenced, addresses embedded | Same relationship type can be embedded or referenced depending on boundedness/query needs |
| Independent child querying | Addresses in Bangalore query | Embedded arrays are awkward when the child is the main query target |
| Many-to-many with snapshot | Products inside orders | Many-to-many does not always require a join collection when order items are snapshots |
| Many-to-many with relationship data | Students, courses, enrollments | Use a relationship collection when the relationship has its own fields |
| Many-to-many with simple array | Products with `categoryIds` | A simple ID array can model a relationship when no relationship fields are needed |
| Duplication vs normalization | `orders.items.nameSnapshot`, `unitPrice` | Duplicate data only when it improves reads or preserves history |
| Document growth | `users.activityLog` vs `user_events` | Growing arrays affect reads, writes, indexes, and document size |
| Unbounded arrays | Product reviews in `products` vs separate `reviews` | Store full children separately but keep small summary fields in parent |
| Attribute Pattern | Product `attributes: [{ name, value }]` | Uniform storage/query/indexing for many variable searchable fields |
| Sparse fields nuance | Phones/shirts/books with different fields | Sparse fields are acceptable when fields are limited and predictable |
| `$elemMatch` nuance | Attribute query by `name` and `value` | Ensures multiple conditions match the same array element |
| Bucket Pattern | Product events grouped by product/date | Reduces many small event documents when events are queried together |
| Bucket boundary | Product + day/hour/eventType examples | Bucket key and size must follow query pattern and volume |
| Subset Pattern | Latest 3 reviews embedded in product | Speeds common reads while full reviews stay separate |
| Subset update cost | `reviews` and `products.recentReviews` | Duplicate subset introduces consistency/update complexity |
| Outlier Pattern | Viral products with very high reviews/events | Exceptional cases should not dictate the common schema |
| Outlier query routing | `hasReviewOutlier` service logic | Application logic chooses normal vs outlier storage path |
| Projection | Product listing fields only | List views should fetch summary fields, not large detail fields |
| Sharding | Candidate shard keys for orders/events/tickets/users | Shard key depends on cardinality, distribution, query routing, hotspots |
| Schema versioning | `schemaVersion` field and migration approaches | Documents may evolve gradually over time |
| Anti-patterns | Designs A, B, C | Diagnose unbounded arrays, over-normalization, and poor shard keys |

---

# Revised Lab Guide

## 1. MongoDB Schema Design Mindset

MongoDB does not force a fixed schema, but schema design is still important.

A good MongoDB schema is designed around:

- application query patterns
- read/write frequency
- relationship size
- data growth
- consistency needs
- scalability requirements

MongoDB schema design is not about removing structure. It is about choosing the right structure for the application workload.

## 2. Query-driven Schema Design

### Concept

Before designing collections, identify query patterns. Start with the questions the application must answer.

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

For an e-commerce system:

| Query Pattern | Likely Collection |
|---|---|
| Show product listing by category and price | `products` |
| Show product details | `products` |
| Show latest orders for user | `orders` |
| Show reviews for product | `reviews` |
| Show open support tickets by priority | `support_tickets` |

### Exercise 13: Identify Query Patterns

For each screen, list the main query fields.

| Application Screen | Query Fields |
|---|---|
| Product listing page | |
| Product detail page | |
| User order history page | |
| Support dashboard | |

Example:

```text
User order history page: userId, createdAt, status
```

#### Model Solution

| Application Screen | Query Fields |
|---|---|
| Product listing page | `category`, `price`, `availability`, `rating`, `brand`, `sortBy` |
| Product detail page | `_id` / `slug`, `productId` |
| User order history page | `userId`, `createdAt`, `status` |
| Support dashboard | `status`, `priority`, `assignedTo`, `createdAt` |

### Takeaway

Design collections, embedded fields, references, and indexes from the most important application queries.

---

## 3. Read/Write Patterns, Duplication, and Snapshots

### Concept

MongoDB schemas often duplicate selected data to make reads faster. Duplication is useful only when
- the duplicated data __does not need to remain current everywhere__
- the duplicated value is intentionally a __historical snapshot__

### Current-state data: avoid duplication

If user/account status frequently changes, duplicating that status in many places is a bad idea.

Bad duplication:

```js
projects.members.status
tasks.assignees.status
comments.authorStatus
messages.senderStatus
notifications.userStatus
```

Suppose a user is suspended, deactivated, or changes account status. If that status is duplicated in many places, one user status update may require updates across thousands or millions of documents.

Better design:

```js
{
  _id: ObjectId("..."),
  title: "Fix payment bug",
  assigneeId: ObjectId("...")
}
```

Then read current status from `users`:

```js
{
  _id: ObjectId("..."),
  name: "John",
  status: "active" // active / suspended / deactivated
}
```

So:

```js
task.assigneeId → users.status
```

is better than duplicating:

```js
task.assigneeStatus
```

because one update to `users.status` is enough.

### Historical snapshot data: duplication is intentional

Orders are often shown with customer name and product snapshot.

```js
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  customerName: "John Doe",
  items: [
    {
      productId: ObjectId("..."),
      name: "iPhone 15",
      price: 79900,
      quantity: 1
    }
  ],
  total: 79900
}
```

Why?

Because one query can fetch the complete order without joining multiple collections.

Good for:

```js
db.orders.find({ userId: ... })
```

Duplicated product/customer data may become stale if the original customer/product changes. That is acceptable for orders because order items are a snapshot at the time of purchase. Past orders should not change when product name or price changes later.

Another order item snapshot shape:

```js
{
  productRef: ObjectId("..."),
  productId: "P000123",
  nameSnapshot: "Electronics Product 123",
  unitPrice: 2499,
  quantity: 2,
  lineTotal: 4998
}
```

A product may also capture category name, even though category name is stored in the `categories` collection, when the application wants to preserve the category name captured at that time.

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

### Takeaway

Duplication is problematic when the duplicated value is expected to remain current everywhere. Duplication is useful when it improves reads or preserves historical state.

---

## 4. Embedding vs Referencing

### Concept

Embedding means storing related data inside the same document.

Referencing means storing related data in a separate collection and keeping an ID reference.

### Embedded example: order items

In `orders`, items are embedded - this was covered earlier as snapshot duplication.

**Takeaway**

Embed when:

- child data is usually read with parent data - Eg. order items are read with orders
- child data is bounded - Eg. 1 to N relationship where N is small and predictable
- child data does not need independent heavy querying - Eg. order items are not queried independently of orders
- parent and child are updated together - Eg. order and its items are created together and not updated separately
- data consistency is not a concern, or application can handle it

### Referenced example: product reviews

Reviews are stored separately - covered earlier as unbounded arrays.

**Takeaway**

Reference when:

- child data can grow without limit - Eg. a product can have thousands of reviews
- child data is queried independently - Eg. find reviews for a product, __find reviews by a user__
- many parents refer to the same child, such as categories and products - Eg. many products can belong to the same category, so category is referenced in products
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

### Takeaway

Embed bounded data that is read with the parent. Reference data that grows independently, is queried independently, or must remain current in one place.

---

## 5. Modeling Relationships

Relationship type alone does not decide the schema. For each relationship, decide whether the related data is bounded, read together, queried independently, frequently updated, or shared.

### 5.1 One-to-One

Example: user and user preferences.

In this dataset, user preferences are embedded:

```js
db.users.findOne({}, { userId: 1, preferences: 1 })
```

This works because each user has one small preferences object.

### 5.2 One-to-Many

Example: user to orders, user to addresses.

A user can have many orders. Orders are stored separately and reference the user:

```js
db.orders.find({ userId: "U000100" })
```

A user can have many addresses. Addresses are embedded inside the user document:

```js
{
  _id: ObjectId("..."),
  name: "John",
  email: "john@example.com",
  addresses: [
    {
      street: "123 Main St",
      city: "Bangalore",
      state: "KA",
      zip: "560001",
      country: "India"
    },
    {
      street: "456 Park Ave",
      city: "Mumbai",
      state: "MH",
      zip: "400001",
      country: "India"
    }
  ],
  ... other fields ...
}
```

Querying addresses:
```js
db.users.findOne({}, { userId: 1, name: 1, email: 1, addresses: 1 })
```

There is a choice here: embed or reference. The decision depends on:

- how many addresses a user can have: bounded vs unbounded
- how often addresses are queried independently, for example for shipping

If addresses are mostly accessed with the user and are not queried independently, embedding is fine.

If addresses are queried independently, the main question is about addresses, not users. In that case, a separate `addresses` collection with a `userId` reference may be better.

Example embedded-address query:

```js
// Find all addresses in Bangalore
db.users.find(
  { "addresses.city": "Bangalore" },
  { name: 1, "addresses.$": 1 }
)
```

This works, but there are two issues:

- you are querying the `users` collection and getting user documents, not address documents
- with `"addresses.$": 1`, MongoDB returns only the first matching address per user

So embedding may not be ideal if addresses need independent querying and scalability.

### 5.3 Many-to-Many

#### Example 1: products and orders - a "snapshot duplication" example

One order can contain many products. One product can appear in many orders.

However, the `orders.items` array stores product snapshots and not only product references. __Embedding product snapshots inside orders optimizes order display and preserves historical data, even though products and orders form a many-to-many relationship.__

#### Example 2: students and courses - a "join collection" example

One student can enroll in many courses. One course can have many students.

In this case, we usually keep separate collections:

- `students`
- `courses`
- `enrollments`

The `enrollments` collection represents the many-to-many relationship.

```js
// students
{
  _id: ObjectId("s1"),
  name: "John",
  email: "john@example.com"
}

// courses
{
  _id: ObjectId("c1"),
  title: "MongoDB Advanced",
  category: "Database"
}

// enrollments
{
  _id: ObjectId("e1"),
  studentId: ObjectId("s1"),
  courseId: ObjectId("c1"),
  enrolledAt: ISODate("2026-06-01"),
  status: "active",
  progress: 40
}
```

Query: find all courses for a student.

```js
db.enrollments.find({
  studentId: ObjectId("s1")
})
```

Query: find all students enrolled in a course.

```js
db.enrollments.find({
  courseId: ObjectId("c1")
})
```

Why separate collections?

Students and courses are both independent entities. Also, the relationship has its own data such as `enrolledAt`, `status`, and `progress`.

Embedding all courses inside students would make course updates harder. Embedding all students inside courses could create large, growing arrays.

#### Example 3: products and categories - a "reference array" example

__This example assumes one product can belong to many categories.__ - the dataset assumes a single category per product, but let's say we want to allow multiple categories per product.

```js
// categories
{
  _id: ObjectId("c1"),
  name: "Electronics",
  slug: "electronics",
  description: "Electronic devices and accessories",
  parentCategoryId: null,
  imageUrl: "/images/electronics.png",
  displayOrder: 1,
  isActive: true
}

{
  _id: ObjectId("c2"),
  name: "Mobile Phones",
  slug: "mobile-phones",
  description: "Smartphones and mobile accessories",
  parentCategoryId: ObjectId("c1"),
  imageUrl: "/images/mobiles.png",
  displayOrder: 2,
  isActive: true
}
```

```js
// products
{
  _id: ObjectId("p1"),
  name: "iPhone 16",
  price: 79900,
  brand: "Apple",
  categoryIds: [
    ObjectId("c1"),
    ObjectId("c2")
  ]
}
```

A separate relationship collection is not needed here because the relationship data is simple: just category IDs. There are no extra fields on the relationship. The `categoryIds` array can handle this many-to-many relationship.

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

## 6. Handling Document Growth and Unbounded Arrays

### Concept

MongoDB has a 16 MB limit on a single document. Even before that limit, very large documents become inefficient.

Document growth becomes risky when:

- arrays keep growing
- frequent updates increase document movement
- large documents are read when only small parts are needed
- indexes on large arrays create many index entries

An unbounded array is an array that can grow without a predictable upper limit.

Examples that can become unbounded:

- product reviews inside a product document
- product events inside a product document
- support messages inside a ticket, if not controlled
- followers/following lists in social apps

### Bounded vs unbounded data

Order items are usually bounded, so embedding them is safer.

Reviews are potentially unbounded, so full reviews should be stored separately. So reviews and products are separate collections, every review has the reference to the product, and the product document can keep small summary fields like `reviewCount` and `averageRating`.

Good design:

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
},
...more reviews...
```

**ASIDE**: You can even keep the __latest 3 reviews embedded inside the product for fast access, while keeping all reviews in a separate collection__. This is a __subset pattern__ that optimizes the common case of showing recent reviews on the product page. Also rating related summary fields avoid scanning all reviews just to show rating summary on product listing or product detail pages.


```js
// products
{
  productId: "P000100",
  name: "Phone",
  reviewCount: 2400,
  rating: 4.5,
  ratingBreakdown: {
    5: 180,
    4: 80,
    3: 30,
    2: 10,
    1: 5
  }
  latestReviews: [
    {
      rating: 5,
      body: "Good"
    },
    {
      rating: 4,
      body: "Nice"
    },
    {
      rating: 3,
      body: "Okay"
    }
  ]
}
```

### Read performance impact

MongoDB stores and reads whole documents, not individual fields as separate rows.

If a document keeps growing:

```js
{
  _id: userId,
  name: "John",
  orders: [ ... thousands of orders ... ],
  addresses: [ ... many addresses ... ],
  activityLog: [ ... thousands of events ... ]
}
```

then even a simple query like:

```js
db.users.findOne({ _id: userId })
```

may read a large document from storage or memory.

Problems:

- more data has to be read from disk or memory
- more data may be sent over the network
- large arrays make filtering inside the document more expensive
- indexes on large arrays can create many index entries

Projection helps reduce network transfer:

```js
db.users.findOne(
  { _id: userId },
  { name: 1, email: 1 }
)
```

But the document may still be large internally, especially if MongoDB has to fetch the full document after using an index.

### Write performance impact

Growing documents can make updates more expensive.

Example:

```js
db.users.updateOne(
  { _id: userId },
  { $push: { activityLog: newEvent } }
)
```

If `activityLog` keeps growing:

- each write modifies a bigger document
- arrays become harder to maintain
- indexes on array fields (multikey indexes) need more maintenance and can grow very large
- the document may eventually approach the 16 MB document limit

Risky design:

```js
users.activityLog: [event1, event2, event3, ... thousands more]
```

Better design:

```js
// users
{
  _id: userId,
  name: "John"
}

// user_events
{
  userId: userId,
  type: "LOGIN",
  createdAt: ISODate(...)
}
```

Then recent activity can be queried separately:

```js
db.user_events.find({ userId }).sort({ createdAt: -1 }).limit(20)
```

### Takeaway

Document growth is fine when embedded data is small and bounded.

Avoid embedding arrays that can grow continuously:

```text
addresses       usually bounded       okay to embed
orders          can grow a lot        usually separate
order items     usually bounded       okay to embed
cart items      usually bounded       okay to embed
activity logs   unbounded             separate collection
reviews         can grow a lot        separate collection
```

---

## 7. Schema Design Patterns Overview

MongoDB schema patterns are reusable modeling strategies.

This session covers:

| Pattern | Purpose |
|---|---|
| Attribute Pattern | Store variable attributes consistently |
| Bucket Pattern | Group many events/readings into bounded buckets |
| Subset Pattern | Store frequently used subset with parent document |
| Outlier Pattern | Handle exceptional documents separately |

---

## 8. Attribute Pattern

### Concept

The Attribute Pattern is useful when documents have different sets of attributes and those attributes need to be searched or filtered dynamically.

In `products`, attributes are stored like this:

```js
attributes: [
  { name: "color", value: "black" },
  { name: "storage", value: "128GB" }
]
```

This helps model category-specific fields without creating many sparse fields.

Nothing is inherently wrong with sparse fields. MongoDB handles missing fields naturally.

This is valid:

```js
// phone
{
  name: "iPhone",
  color: "black",
  storage: "128GB",
  ram: "8GB"
}

// shirt
{
  name: "T-shirt",
  size: "M",
  fabric: "cotton",
  color: "blue"
}

// book
{
  name: "MongoDB Guide",
  author: "John",
  pages: 300,
  language: "English"
}
```

Sparse fields are fine when:

```text
the set of fields is small and predictable
```

Example:

```js
name
price
brand
category
color
size
```

### Problem with many sparse searchable fields

The problem starts when you have many product categories with many different searchable fields:

```js
storage
ram
screenSize
fabric
size
author
pages
language
material
warranty
batteryLife
processor
shoeSize
gender
```

Now queries become category-specific:

```js
db.products.find({
  category: "phones",
  storage: "128GB",
  color: "black"
})
```

```js
db.products.find({
  category: "shirts",
  size: "M",
  fabric: "cotton"
})
```

```js
db.products.find({
  category: "books",
  author: "John",
  language: "English"
})
```

To optimize these, you may need many different indexes:

```js
db.products.createIndex({ category: 1, storage: 1 })
db.products.createIndex({ category: 1, ram: 1 })
db.products.createIndex({ category: 1, size: 1 })
db.products.createIndex({ category: 1, fabric: 1 })
db.products.createIndex({ category: 1, author: 1 })
db.products.createIndex({ category: 1, language: 1 })
```

This becomes hard to maintain.

### Attribute Pattern makes querying more uniform

```js
{
  name: "iPhone",
  category: "phones",
  attributes: [
    { name: "color", value: "black" },
    { name: "storage", value: "128GB" },
    { name: "ram", value: "8GB" }
  ]
}
```

Now many filters use the same structure:

```js
db.products.find({
  category: "phones",
  attributes: {
    $elemMatch: {
      name: "storage",
      value: "128GB"
    }
  }
})
```

Useful index:

```js
db.products.createIndex({
  category: 1,
  "attributes.name": 1,
  "attributes.value": 1
})
```

So instead of creating many indexes for many optional fields, you create a smaller number of generic indexes.

### Exercise 16: Query Attributes

Create index:

```js
db.products.createIndex({ "attributes.name": 1, "attributes.value": 1 })
```

Find products with a specific attribute. We use `$elemMatch` when multiple conditions must match the same embedded object inside an array.

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

### Takeaway

Do not use the Attribute Pattern just because fields are missing sometimes. Use it when the number of possible fields keeps growing and you need a common way to store, query, and index them.

---

## 9. Bucket Pattern

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

In a raw event design, each event is stored as a separate document:

```js
{
  productId: "P000100",
  eventType: "product_view",
  occurredAt: ISODate("2026-05-01T10:15:00Z")
}
```

This is simple, but for high-volume event data, it can create a very large number of small documents.

Possible bucketed design:

```js
{
  productId: "P000100",
  bucketDate: ISODate("2026-05-01"),
  eventCount: 120,
  events: [
    { eventType: "product_view", occurredAt: ISODate("2026-05-01T10:15:00Z") },
    { eventType: "add_to_cart", occurredAt: ISODate("2026-05-01T10:18:00Z") }
  ]
}
```

In this design, events are grouped by `productId` and `bucketDate`.

Instead of storing 120 separate event documents for product `P000100` on `2026-05-01`, we store one bucket document containing 120 events.

This can reduce document count and make queries more efficient when the common access pattern is:

```js
// Get all events for a product on a given day
db.product_event_buckets.findOne({
  productId: "P000100",
  bucketDate: ISODate("2026-05-01")
})
```

__The bucket should remain bounded__. For example, bucket by day, hour, or fixed event count depending on event volume.

__The goal is not to create one huge document forever, but to group related events into reasonably sized documents.__

### Exercise 17: Understand Event Volume

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

Find event volume by date and productId. Sort by count.

```js
db.product_events.aggregate([
  {
    $group: {
      _id: {
        productId: "$productId",
        year: { $year: "$occurredAt" },
        month: { $month: "$occurredAt" },
        day: { $dayOfMonth: "$occurredAt" }
      },
      count: { $sum: 1 }
    }
  },
  { $sort: { "count": -1 } },
  { $limit: 10 }
])
```

Reflection:

1. Why might raw event documents become expensive at large scale?
2. When would bucketed documents help?
3. What should define a bucket: product, time, session, or something else?

Raw event documents can become expensive because every event is stored as a separate document.

If a product gets millions of views, clicks, cart additions, and purchases, the collection can grow very quickly.

Problems:

- very large number of documents
- larger indexes
- more index maintenance during writes
- more documents to scan during analytics
- more storage overhead
- aggregation queries ("group by") can become expensive. For example, this query may need to process many documents:

```js
db.product_events.aggregate([
  { $group: { _id: "$productId", eventCount: { $sum: 1 } } }
])
```

Bucketed documents help when events are frequently queried together For example, if the common query is:

```js
// Get all events for one product on one day
db.product_event_buckets.findOne({
  productId: "P000100",
  bucketDate: ISODate("2026-05-01")
})
```

then storing those events together makes sense.

Bucketed documents are useful when:

- events are high volume
- events are mostly read by time range
- events are often grouped by product, user, device, session, or date
- detailed individual event updates are rare
- the bucket size can be bounded

The bucket should be defined by the main query pattern.

For product activity analytics, this is a good bucket key:

```js
{
  productId: "P000100",
  bucketDate: ISODate("2026-05-01")
}
```

Other possible bucket choices:

```text
product + day     → product analytics
user + day        → user activity history
sessionId         → session replay / session analysis
deviceId + hour   → IoT or sensor readings
category + day    → category-level analytics
```

Choose a bucket size based on volume:

```text
Low event volume     → product + day
High event volume    → product + hour
Very high volume     → product + hour + eventType
Session-based data   → sessionId
```

### Takeaway

Choose the bucket based on how the application reads the data. Keep each bucket bounded.

---

## 10. Subset Pattern

### Concept

The Subset Pattern stores frequently needed child data with the parent, while keeping the full data separately.

Example: a product page may need only the latest 3 reviews, not all reviews - _we have covered this example earlier as a possible optimization in the unbounded arrays section_.

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

### Takeaway

Subset Pattern improves read performance, but increases write/update complexity.

The same review data now exists in two places:

```text
reviews collection
products.recentReviews
```

So updates must keep them consistent.

---

## 11. Outlier Pattern

### Concept

The Outlier Pattern handles exceptional cases separately, so the common case stays simple and fast.

Example: most products may have a manageable number of events or reviews. A few viral products may have extremely high activity.

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

### Exercise 18: Identify Outliers

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

### Query logic for normal and outlier products

Outliers can be handled with service-level logic. This example is for product reviews, but similar logic can apply to events or other data.

```js
const product = db.products.findOne({ productId: "P000100" })

// not an outlier - has embedded reviews
if (!product.hasReviewOutlier) {
  return db.reviews.find({
    productId: product.productId,
    status: "approved"
  }).sort({ createdAt: -1 }).limit(10)
}

// is an outlier - fetch reviews metadata from outliers collection (`reviewCount`, `averageRating`)...
const outlier = db.product_review_outliers.findOne({
  productId: product.productId
})

// ...then fetch latest reviews from archive collection using the reference in outlier document
return db.reviews_archive.find({
  productId: product.productId,
  status: "approved"
}).sort({ createdAt: -1 }).limit(10)
```

### Takeaway

Outliers should not dictate the schema for normal documents. Keep the common case simple, and route exceptional cases through separate storage or logic.

---

## 12. Using Projections Effectively

### Concept

Projection is a schema and query design tool.

Even if a document contains many fields, not every query needs all fields. 

_Example_: Fields not required for the listing page should be excluded. For example, a product listing page may not need

```text
full description
long specifications
all product images
reviews
questions and answers
supplier details
inventory history
audit fields
large attributes
product events
```

__Large fields should be avoided because a listing page returns many products at once__.

A projection keeps the result small (along with a limit) and avoids sending large fields over the network, and avoids reading large fields from disk or memory.

```js
[
  {
    _id: 0,
    productId: 1,
    name: 1,
    salePrice: 1,
    rating: 1,
    reviewCount: 1,
    "stock.status": 1
  },
  ...more products...
]
```

### Takeaway

List views should fetch only summary fields. Detail pages can fetch larger fields when needed.

---

## 13. Designing for Sharding

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

### Exercise 19: Evaluate Shard Key Candidates

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

### Takeaway

Shard key choice is both
  - a data-distribution decision, and
  - a query-routing decision.

---

## 14. Schema Versioning

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

### Exercise 20: Add Schema Version to Sample Documents

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

Schema versioning is useful because MongoDB collections can contain documents with different shapes over time.

For small collections, updating all documents immediately may be fine. For large collections, it may be better to migrate gradually.

```text
update documents in batches
migrate only active records first
migrate when a document is read or written
support old and new versions temporarily
```

Supporting multiple schema versions makes application logic more complex.

For example, code may need to handle both:

```js
// version 1
{
  productId: "P000100",
  price: 1000
}
```

and:

```js
// version 2
{
  productId: "P000100",
  pricing: {
    mrp: 1200,
    salePrice: 1000
  }
}
```

Risks include:

```text
more conditional logic in code
harder testing
bugs due to old document shapes
inconsistent query behavior
more complex indexes
long-term technical debt
```

**Takeaway**

```text
Schema versioning is useful for safe migrations, but old versions should not be supported forever unless necessary.
```

---

## 15. Schema Anti-patterns

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

## Final Session Takeaway

A scalable MongoDB schema is workload-driven:

```text
Start with query patterns.
Embed bounded data read with the parent.
Reference data that grows, changes often, or is queried independently.
Duplicate only when it improves reads or preserves historical snapshots.
Use schema patterns to handle variability, high-volume events, common subsets, and outliers.
Use projections, shard keys, and schema versioning deliberately.
```

---

## Session 2 End-of-Session Lab: Design a Short Application Schema

**Time:** 20 minutes (Covered only if time permits)
**Goal:** Design a MongoDB schema from application requirements using the patterns learned in this session.

### Application: Online Learning Platform

The application supports online courses and live workshops. Users can browse courses, enroll, watch lessons, submit reviews, and track activity.

Main requirements:

1. Users browse active courses by `category`, `level`, `price`, and `rating`.
2. A course detail page showsSe course information, instructor summary, modules, rating summary, and latest 3 approved reviews.
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

- A. Application query patterns
- B. Alphabetical field order
- C. Number of developers
- D. UI color theme

### Q2. A small user preferences object is always displayed with the user profile and updated with the user. Which design is generally suitable?

- A. Store preferences in millions of separate collections
- B. Use a text index for preferences
- C. Embed preferences inside the user document
- D. Store preferences only in application memory

### Q3. A news article can receive thousands of comments over time. Which design is usually safer?

- A. Embed all comments forever in the article document
- B. Store comments in the article title field
- C. Use one collection per comment
- D. Store comments in a separate collection with article references

### Q4. A customer can place many orders. Orders are queried independently and may grow over time. Which relationship modeling choice is generally better?

- A. Embed all orders forever inside customer
- B. Store orders separately with customer reference
- C. Store customers inside every order item only
- D. Avoid storing customer identity

### Q5. An order stores the product name and price at purchase time. Why can this be useful?

- A. It prevents all future product updates
- B. It removes the need for indexes
- C. It preserves historical order details
- D. It guarantees product stock availability

### Q6. Which design is most likely to cause document growth problems?

- A. Embedding all user activity events forever
- B. Embedding one small address object
- C. Storing a fixed settings object
- D. Keeping a small status field

### Q7. Products in different categories have different specifications. Which pattern helps model variable attributes consistently?

- A. Outlier Pattern
- B. Bucket Pattern
- C. Schema Versioning Pattern
- D. Attribute Pattern

### Q8. A system records millions of temperature readings per device per day. Which pattern can group readings into bounded documents?

- A. Unique Index Pattern
- B. Bucket Pattern
- C. Text Search Pattern
- D. Over-normalization Pattern

### Q9. A product page usually shows only the latest three reviews, while all reviews remain queryable separately. Which pattern fits this design?

- A. Subset Pattern
- B. Hashed Pattern
- C. Parallel Array Pattern
- D. Sparse Document Pattern

### Q10. Which field is usually a poor shard key candidate?

- A. A high-cardinality user identifier
- B. A low-cardinality field like department
- C. A frequently queried customer identifier
- D. A well-distributed event identifier

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
