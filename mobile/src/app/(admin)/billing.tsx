import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Billing records" subtitle="Provider-confirmed charges" table="jela_billing_records" primaryField="description" secondaryFields={['user_id', 'amount_minor', 'currency', 'status', 'provider', 'created_at']} />; }
