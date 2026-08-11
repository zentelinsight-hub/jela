import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Audit log" subtitle="Administrative mutations" table="jela_audit_logs" primaryField="action" secondaryFields={['actor_id', 'target_type', 'target_id', 'metadata', 'created_at']} />; }
