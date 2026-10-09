-- The prototype self-grant RPC bypasses Stripe. No application route uses it.
begin;
revoke all on function public.select_prototype_membership(text) from public, anon, authenticated;
commit;
