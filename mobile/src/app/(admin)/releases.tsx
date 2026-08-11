import { AdminResourceScreen } from '@/components/admin-resource-screen';
export default function Screen() { return <AdminResourceScreen title="Android releases" subtitle="Published APK metadata" table="jela_ai_releases" primaryField="version_name" secondaryFields={['version_code', 'storage_path', 'sha256', 'minimum_supported_version', 'force_update', 'is_current', 'published_at']} />; }
