import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Security events" subtitle="Account and authorization events" table="jela_security_events" primaryField="event_type" secondaryFields={['actor_id', 'subject_id', 'severity', 'ip_address', 'created_at']} />; }
