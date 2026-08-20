insert into public.subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment)
select '7f91e8ed-6716-4fb8-a350-add0a69832b3', 'comp_admin_'||env, 'comp_admin', 'progressor_pro', 'pro_monthly', 'active', now(), now() + interval '10 years', false, env
from (values ('sandbox'),('live')) as t(env)
where not exists (
  select 1 from public.subscriptions s
  where s.user_id = '7f91e8ed-6716-4fb8-a350-add0a69832b3' and s.environment = t.env
);