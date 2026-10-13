ALTER TABLE store_orders ADD COLUMN shipping_carrier varchar(40);
ALTER TABLE store_orders ADD COLUMN pickup_date varchar(10);
ALTER TABLE store_orders ADD COLUMN pickup_window varchar(40);
ALTER TABLE store_orders ADD COLUMN pickup_confirmation varchar(100);
ALTER TABLE store_orders ADD COLUMN tracking_number varchar(80);
ALTER TABLE store_orders ADD COLUMN tracking_url text;
