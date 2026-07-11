begin;

-- Fix: transition_post_status was only granted to `authenticated`, but
-- server-side callers (POST /api/posts/manage DELETE, PATCH archive,
-- POST /api/posts/status, and transitionLinkedPostStatus from order
-- routes) all invoke it via the admin client which authenticates as
-- `service_role`.  Without EXECUTE permission the PostgREST call fails
-- with a permission error, surfacing as a 500 to the client.

grant execute on function public.transition_post_status(uuid, text, uuid)
  to service_role;

-- Reload PostgREST schema cache so the updated grant takes effect immediately
notify pgrst, 'reload schema';

commit;
