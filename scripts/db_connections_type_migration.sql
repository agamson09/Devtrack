-- Multi-DBMS support for saved database connections (Navicat-style)
ALTER TABLE db_connections
  ADD COLUMN type ENUM('mysql', 'postgres', 'mssql') DEFAULT 'mysql';
