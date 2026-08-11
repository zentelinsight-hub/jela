import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Usage" subtitle="AI requests and metering" table="jela_ai_usage" primaryField="request_id" secondaryFields={['user_id', 'model', 'input_tokens', 'output_tokens', 'credits_charged', 'status', 'created_at']} />; }
