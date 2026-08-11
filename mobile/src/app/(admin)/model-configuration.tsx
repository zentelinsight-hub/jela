import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Model configuration" subtitle="Active server-side AI routes" table="jela_model_config" primaryField="name" secondaryFields={['provider', 'model', 'mode', 'reasoning_effort', 'tools', 'enabled', 'updated_at']} />; }
