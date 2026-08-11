import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Plans" subtitle="Published plan catalog and active version" table="jela_plans" primaryField="name" secondaryFields={['code', 'price_minor', 'currency', 'interval', 'most_popular', 'current_version_id', 'active']} />; }
