#!/bin/bash

URI="${MONGOSH_URI:-mongodb://localhost:27017}"
DB="${DB_NAME:-ecommerce}"

mongoimport --uri "$URI" --db "$DB" --collection users --file datasets/users.ndjson
mongoimport --uri "$URI" --db "$DB" --collection products --file datasets/products.ndjson
mongoimport --uri "$URI" --db "$DB" --collection categories --file datasets/categories.ndjson
mongoimport --uri "$URI" --db "$DB" --collection orders --file datasets/orders.ndjson
mongoimport --uri "$URI" --db "$DB" --collection reviews --file datasets/reviews.ndjson
mongoimport --uri "$URI" --db "$DB" --collection inventory --file datasets/inventory.ndjson
mongoimport --uri "$URI" --db "$DB" --collection support_tickets --file datasets/support_tickets.ndjson
mongoimport --uri "$URI" --db "$DB" --collection product_events --file datasets/product_events.ndjson