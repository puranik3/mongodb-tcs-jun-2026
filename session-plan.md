# MongoDB Advanced Topics Training Plan (8 Hours Total)

## Session 1 (4 Hours Including Break)

# MongoDB Indexing and Query Performance Optimization

### Learning Outcome

By the end of this session, participants will understand query execution and indexing, design efficient indexes using the ESR rule, optimize queries using `explain()`, convert `COLLSCAN` to `IXSCAN`, and improve performance using projections and limits.

| Topic                                                  |   Duration |
| ------------------------------------------------------ | ---------: |
| Introduction to Query Performance in MongoDB           |     10 min |
| COLLSCAN vs IXSCAN                                     |     20 min |
| Using `explain()` for Query Plans                      |     25 min |
| Index Selectivity and Cardinality                      |     15 min |
| Creating and Managing Indexes                          |     20 min |
| Index Types (Single, Compound, Multikey, Text, Hashed) |     25 min |
| **Break**                                              | **10 min** |
| ESR Rule (Equality, Sort, Range)                       |     25 min |
| Covered Queries                                        |     15 min |
| Filtering and Limiting Data Volume                     |     10 min |
| Avoiding Over-fetching                                 |     10 min |
| Sorting with Indexes                                   |     15 min |
| Index Maintenance and Trade-offs                       |     15 min |
| Performance Anti-patterns                              |     15 min |
| Hands-on Optimization Lab                              |  10-20 min |

**Instruction Time:** 240 min (4h)
**Break:** 10 min
**Total Session Duration:** 250 min (4h 10m)

### Hands-on Optimization Lab

* Analyze query plans using `explain()`
* Identify `COLLSCAN` operations
* Create and compare indexes
* Apply ESR rule to compound indexes
* Optimize sorting and filtering queries
* Build covered queries
* Measure performance improvements

---

## Session 2 (4 Hours Including Break)

# Strategic Schema Design in MongoDB

### Learning Outcome

By the end of this session, participants will be able to design scalable MongoDB schemas based on query patterns, understand embedding vs referencing, avoid unbounded arrays, apply schema patterns, and optimize data models for performance and scalability.

| Topic                                    |   Duration |
| ---------------------------------------- | ---------: |
| Introduction to Schema Design in MongoDB |     10 min |
| Schema Design Principles                 |     20 min |
| Query-driven Schema Design               |     20 min |
| Embedding vs Referencing                 |     25 min |
| Modeling Relationships (1-1, 1-N, N-N)   |     25 min |
| Data Duplication vs Normalization        |     15 min |
| Handling Document Growth                 |     15 min |
| Avoiding Unbounded Arrays                |     15 min |
| **Break**                                | **10 min** |
| Schema Design Patterns Overview          |     10 min |
| Attribute Pattern                        |     15 min |
| Bucket Pattern                           |     15 min |
| Subset Pattern                           |     15 min |
| Outlier Pattern                          |     15 min |
| Using Projections Effectively            |     10 min |
| Designing for Sharding                   |     20 min |
| Schema Versioning                        |     10 min |
| Schema Anti-patterns                     |     10 min |

**Instruction Time:** 265 min (4h 25m)
**Break:** 10 min
**Total Session Duration:** 275 min (4h 35m)

### Schema Design Workshop (Self-exploration)

* Design an e-commerce schema based on query requirements
* Model users, products, orders, and reviews
* Choose between embedding and referencing
* Apply Attribute, Bucket, Subset, and Outlier patterns
* Identify and fix schema anti-patterns
* Review scalability and sharding considerations

---

# Prerequisites

* Basic MongoDB CRUD operations
* Familiarity with JSON/BSON documents
* Experience writing MongoDB queries
* Basic understanding of database concepts

# Dataset Used Throughout

A single e-commerce dataset containing:

* Users
* Products
* Orders
* Reviews
* Categories
* Inventory

The same dataset will be used throughout both sessions to connect schema design decisions with indexing and query performance outcomes.
