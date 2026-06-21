#!/bin/bash

mongoimport --db ecommerce --collection users --file datasets/users.ndjson
mongoimport --db ecommerce --collection products --file datasets/products.ndjson
mongoimport --db ecommerce --collection categories --file datasets/categories.ndjson
mongoimport --db ecommerce --collection orders --file datasets/orders.ndjson
mongoimport --db ecommerce --collection reviews --file datasets/reviews.ndjson
mongoimport --db ecommerce --collection inventory --file datasets/inventory.ndjson
mongoimport --db ecommerce --collection support_tickets --file datasets/support_tickets.ndjson
mongoimport --db ecommerce --collection product_events --file datasets/product_events.ndjson