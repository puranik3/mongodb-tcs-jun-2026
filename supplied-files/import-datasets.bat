@echo off

REM Set MongoDB URI, default to localhost if MONGOSH_URI is not set
if not defined MONGOSH_URI (
    set "URI=mongodb://localhost:27017"
) else (
    set "URI=%MONGOSH_URI%"
)

REM Set database name, default to ecommerce if DB_NAME is not set
if not defined DB_NAME (
    set "DB=ecommerce"
) else (
    set "DB=%DB_NAME%"
)

REM Import all datasets
mongoimport --uri "%URI%" --db "%DB%" --collection users --file datasets/users.ndjson
mongoimport --uri "%URI%" --db "%DB%" --collection products --file datasets/products.ndjson
mongoimport --uri "%URI%" --db "%DB%" --collection categories --file datasets/categories.ndjson
mongoimport --uri "%URI%" --db "%DB%" --collection orders --file datasets/orders.ndjson
mongoimport --uri "%URI%" --db "%DB%" --collection reviews --file datasets/reviews.ndjson
mongoimport --uri "%URI%" --db "%DB%" --collection inventory --file datasets/inventory.ndjson
mongoimport --uri "%URI%" --db "%DB%" --collection support_tickets --file datasets/support_tickets.ndjson
mongoimport --uri "%URI%" --db "%DB%" --collection product_events --file datasets/product_events.ndjson

echo Datasets imported successfully!
pause
