import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Model configuration" subtitle="Active AI policy" table="jela_model_config" primaryField="name" secondaryFields={['provider', 'model', 'input_credit_cost', 'output_credit_cost', 'enabled', 'updated_at']} />; }
