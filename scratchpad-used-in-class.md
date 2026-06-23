## How index is created
_DB file_
- has all fields for user in the document
0x12345678: jon@example.com, JOn
0x12345677: alice@example.com, 
0x12345679: emily.christy@example.com, Christy
0x12345680: bob.punith@example.com, Punith
0x12345681: bharath@example.com, Bharath

_Index on email field_
- Index has email and reference to the document in the DB file
alice@example.com -> 0x12345677
bharath@example.com -> 0x12345681
bob.punith@example.com -> 0x12345680
emily.christy@example.com -> 0x12345679
jon@example.com -> 0x12345678

---

- Creating an index on the email field in the users collection can be done using the following command:
```js
db.users.createIndex( { email: 1 } )
```

- When in-memory sort is needed vs no sort needed
- __no in-memory sort -> index on email field__
```text
Q1: db.users.find( { email: "jon@example.com" }, { email: 1, name: 1 } ).sort( { email: 1 } )
```
- __in-memory sort -> index on email field__
```text
Q2: db.users.find( { email: "jon@example.com" }, { email: 1, name: 1 } ).sort( { name: 1 } )
```

---

- How query is planned and executed by the query planner
1. Give a query
2. Indexes are checked
3. Query is planned
4. Query executes

---

- When can you use explain()?
To use explain(), you need a cursor. You can use it with find() but not with findOne().
    - You can use with sort() and limit() as well.
    - count() is a special case, it does not return a cursor, so you cannot use explain() with count(). You can use countDocuments() instead.

---

__Compound index__
```text
{ x : 1, y : 1, z : 1 }
```

- When will the index be used for the following queries?
```text
find(x) -> index can be used
find(y) -> index cannot be used
find(x).sort(y) -> index can be used
find(x).sort(y: 1, z: 1) -> index can be used
find(x).sort(z) -> index cannot be used
find().sort(y: 1, z: 1) -> index cannot be used
find(x).sort(z: 1, y: 1) -> index cannot be used
```text

---

- How sorting order matters in compound index
```text
find(x).sort(y: 1, z: 1) -> index can be used
find(x).sort(y: -1, z: -1) -> index can be used
find(x).sort(y: 1, z: -1) -> index cannot be used
find(x).sort(y: -1, z: 1) -> index cannot be used
```text

---

- Another example of compund index
```text
{ x : 1, y : 1, z : -1 }
```

```text
find(x).sort(y: 1, z: 1) -> index cannot be used
find(x).sort(y: 1, z: -1) -> index can be used
find(x).sort(y: -1, z: 1) -> index can be used
find(x).sort(y: -1, z: -1) -> index cannot be used
```

--- 

- When index is redundant and hence can be hidden
- Lets say we have 2 indexes
```text
{ x: 1 }
{ x: 1, y: 1 }
```
```text
find( x = 1 ) -> index { x: 1 } can be used, { x: 1, y: 1 } can also be used
```

- { x: 1 } -> can be hidden -> keep the index but do not use it for query planning

**TAKEAWAY**
- Sometimes indexes are unnecessary and can be hidden to avoid query planner using them.

---

**Text index**
- Only 1 text index per collection
- products collection
```js
{ name: "iPhone 12", description: "Apple's latest smartphone", version: "12.0", "color": "black", "price": 999 }
{ name: "Samsung Galaxy S21", description: "Samsung's flagship phone", version: "21.0" }
{ name: "Google Pixel 5", description: "Google's latest phone", version: "5.0" }
```

Select the text fields for text index
- name
- description
- version

- What happens when you create a text index?
When you create a text index, MongoDB will tokenize the text fields and create an index on the tokens. This allows you to perform text search queries on the indexed fields.

**Hashed index**
- DOES NOT REQUIRE UNIQUE VALUES for indexed field (works on both user email and user name)
- Cannot be used for range queries ({ field : { $gte: 100 } }). Useful for sharding and equality queries ( { field : value } )
- Used to speed up equality queries on fields that have a large number of distinct values, such as user email or user name. It is not suitable for fields that have a small number of distinct values,
- db.user.find( { name: "Kapil" } ) -> hashed index on name field can be used

**Unique index**
- REQUIRES UNIQUE VALUES for indexed field (works on user email, will not work on user name)

**Partial index**
- Indexes only a __subset of documents__ in a collection based on a filter expression. This can be useful for optimizing queries that only need to access a specific subset of documents, such as inactive users
```js
db.users.createIndex(
  { status: 1 },
  {
    partialFilterExpression: {
      status: "inactive"
    }
  }
)
```
inactive users -> index can be used
``js
db.users.find( { status: "inactive" } ) -> index can be used
```
inactive users index will be smaller in size

**Covered query**
- A query is considered covered if all the fields in the query are part of an index, including the fields returned in the projection. This means that the query can be satisfied entirely using the index, without having to read the actual documents from the collection.
- Entries in index { status: 1, email: 1, userId: 1 }
```text
status: 'inactive', email: 'user@example.com', userId: 123 -> document 0x12345678
status: 'active', email: 'activeuser@example.com', userId: 124 -> document 0x12345679
```

**Drawbacks on indexes**
- Indexes take up disk space and memory
- Indexes can slow down write operations, as the index needs to be updated whenever a document is inserted, updated, or deleted. This can lead to increased latency for write-heavy workloads.
    - Without index: Add user -> Adds to DB file -> 10 ms
    - With index: Add user -> Adds to DB file -> Updates index files -> 20 ms

**DB Design**

**Data duplication**
- A scenario where we are fine with data duplication - think order and products
- Correct
```js
{
    customerName: "John Doe",
    items: [
        { productId: 1, productName: "Product A", price: 10 },
        { productId: 2, productName: "Product B", price: 20 }
    ]
}
```
- Incorrect
```js
{
    customerName: "John Doe",
    items: [1, 2]
}
```

**Embedding and References**
```js
{
    _id: 1,
    name: "John Doe",
    address: {
        street: "123 Main St",
        city: "Anytown",
        state: "CA",
        zip: "12345"
    }
}
```
- In case of multiple addresses, we can use an array of embedded documents
```js
{
    _id: 1,
    name: "John Doe",
    addresses: [
        {
            street: "123 Main St",
            city: "Anytown",
            state: "CA",
            zip: "12345"
        },
        {
            street: "456 Oak St",
            city: "Othertown",
            state: "NY",
            zip: "67890"
        }
    ]
}
```
- In case of single reference, we can use a reference to another document. An order can be placed by one user only
```js
{
    _id: 1,
    userId: 123, // reference to the user document (_id)
    items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 }
    ]
}
```
- Suppose product can belong to multiple categories, we can use an array of references to category documents
```js
{
    _id: 1,
    name: "Product A",
    categoryIds: [1, 2] // references to category documents (_id)
}
```

**Embedding vs References**
- Order and order items.
- The max. size of a single document in MongoDB is 16 MB. If the order items can grow beyond this limit, we should use references instead of embedding.
- We do not expect items to grow beyond 16 MB, we can use embedding for better performance and simplicity.
**Example of embedding for 1:N relationship**
- Option A: Embedding
```js
{
    _id: 1,
    userName: "JOhn Doe",
    oid: "OID123",
    items: [
        { /*productId: 1,*/ productName: 'A', quantity: 2, price: 10 },
        { /*productId: 2,*/ productName: 'B', quantity: 1, price: 20 }
    ]
}
```
- Option B: References
- order
```js
{
    _id: 1,
    userName: "John Doe",
    items: [ OI123, OI234]
}
```
- order_item
```js
{
    _id: "OI123",
    orderId: 1,
    productId: 1,
    quantity: 2,
    price: 10
},
{
    _id: "OI234",
    orderId: 1,
    productId: 2,
    quantity: 1,
    price: 20
}
```

**Relationship Cardinality**
- 1:1 -> One user has one profile - user and profile can be embedded in the same document
```js
{
    _id: 1,
    userName: "John Doe",
    profile: {
        age: 30,
        preferredContactMethod: "email"
    }
}
```
- unless size of total document exceeds 16 MB, we can embed profile in user document

**Attribute Pattern**
```js
{
    _id: 1,
    name: "Head First Java",
    price: 500,
    averageRating: 4.6,
    attributes: [
        { name: "author", value: "Kathy Sierra" },
        { name: "publisher", value: "O'Reilly Media" },
        { name: "language", value: "English" },
        { name: "numPages", value: 720 },
        { name: "isbn", value: "978-0596009205" }
    ]
}
