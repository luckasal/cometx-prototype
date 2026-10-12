-- Restricted roles do not inherit Admin RLS or direct RPC access.
-- Their access is mediated by permission-checked server handlers.
alter type public.app_role add value if not exists 'event_manager';
alter type public.app_role add value if not exists 'data_analyst';
alter type public.app_role add value if not exists 'marketing';
