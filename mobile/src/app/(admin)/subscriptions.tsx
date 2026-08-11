import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Subscriptions" subtitle="Provider-confirmed states" table="jela_subscriptions" primaryField="status" secondaryFields={['user_id', 'plan_id', 'provider', 'current_period_end', 'cancel_at_period_end']} />; }
