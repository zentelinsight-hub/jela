import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="App settings" subtitle="Backend feature flags" table="jela_app_config" primaryField="key" secondaryFields={['value', 'description', 'updated_at']} />; }
