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

- When can you ise explain()?
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
