import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Credit wallets" subtitle="Balances and reservations" table="jela_credit_wallets" primaryField="user_id" secondaryFields={['balance', 'reserved', 'lifetime_granted', 'lifetime_used', 'updated_at']} />; }
