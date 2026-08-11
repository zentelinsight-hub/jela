import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Requests & errors" subtitle="Failed AI operations" table="jela_ai_usage" primaryField="request_id" secondaryFields={['user_id', 'status', 'error_code', 'error_message', 'created_at']} />; }
