-- Align the application status vocabulary with the product contract without touching auth.users.
alter type public.jela_account_status rename value 'pending' to 'restricted';
alter type public.jela_account_status rename value 'disabled' to 'deactivated';
