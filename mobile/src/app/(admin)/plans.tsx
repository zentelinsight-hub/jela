import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Plans" subtitle="Published plan catalog" table="jela_plans" primaryField="name" secondaryFields={['code', 'price_minor', 'currency', 'interval', 'credits', 'active']} />; }
