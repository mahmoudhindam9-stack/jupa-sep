-- ==============================================================================
-- TEMPORARY DEVELOPMENT MODE: BYPASS AUTHENTICATION & ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Purpose: Temporarily allow unrestricted access for development and debugging.
-- All database operations (SELECT, INSERT, UPDATE, DELETE) are permitted for
-- both anon and authenticated users across all core tables.
--
-- RESTORATION INSTRUCTIONS:
-- To restore security after development testing is completed, revert the changes
-- in this migration or drop the temporary policies ("TEMP_DEV_ALL_*") and restore
-- the original definitions of is_admin(), is_manager_or_admin(), and is_staff().
-- ==============================================================================

-- 1. Grant table access privileges to anon, authenticated, and service_role
GRANT ALL ON public.inventory TO anon, authenticated, service_role;
GRANT ALL ON public.inventory_transactions TO anon, authenticated, service_role;
GRANT ALL ON public.recipes TO anon, authenticated, service_role;
GRANT ALL ON public.recipe_ingredients TO anon, authenticated, service_role;
GRANT ALL ON public.menu_items TO anon, authenticated, service_role;
GRANT ALL ON public.menu_categories TO anon, authenticated, service_role;
GRANT ALL ON public.orders TO anon, authenticated, service_role;
GRANT ALL ON public.tables TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;

-- 2. Redefine authorization helper functions to return true during Dev Mode
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin() RETURNS boolean AS $$
  SELECT true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean AS $$
  SELECT true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Create explicit, identifiable temporary development RLS policies for all tables

-- Inventory
DROP POLICY IF EXISTS "TEMP_DEV_ALL_inventory" ON public.inventory;
CREATE POLICY "TEMP_DEV_ALL_inventory" ON public.inventory
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Inventory Transactions
DROP POLICY IF EXISTS "TEMP_DEV_ALL_inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "TEMP_DEV_ALL_inventory_transactions" ON public.inventory_transactions
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Recipes
DROP POLICY IF EXISTS "TEMP_DEV_ALL_recipes" ON public.recipes;
CREATE POLICY "TEMP_DEV_ALL_recipes" ON public.recipes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Recipe Ingredients
DROP POLICY IF EXISTS "TEMP_DEV_ALL_recipe_ingredients" ON public.recipe_ingredients;
CREATE POLICY "TEMP_DEV_ALL_recipe_ingredients" ON public.recipe_ingredients
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Menu Items
DROP POLICY IF EXISTS "TEMP_DEV_ALL_menu_items" ON public.menu_items;
CREATE POLICY "TEMP_DEV_ALL_menu_items" ON public.menu_items
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Categories
DROP POLICY IF EXISTS "TEMP_DEV_ALL_menu_categories" ON public.menu_categories;
CREATE POLICY "TEMP_DEV_ALL_menu_categories" ON public.menu_categories
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Orders
DROP POLICY IF EXISTS "TEMP_DEV_ALL_orders" ON public.orders;
CREATE POLICY "TEMP_DEV_ALL_orders" ON public.orders
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Tables
DROP POLICY IF EXISTS "TEMP_DEV_ALL_tables" ON public.tables;
CREATE POLICY "TEMP_DEV_ALL_tables" ON public.tables
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Profiles
DROP POLICY IF EXISTS "TEMP_DEV_ALL_profiles" ON public.profiles;
CREATE POLICY "TEMP_DEV_ALL_profiles" ON public.profiles
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Grant EXECUTE permissions on all RPC functions to anon and authenticated
GRANT EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.convert_to_inventory_unit(numeric, text, text) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.run_e2e_inventory_test() TO anon, authenticated, public;
