import { ConversationList } from '@/components/conversation-list';
import { PageScreen } from '@/components/page-screen';

export default function HistoryScreen() {
  return <PageScreen title="History" subtitle="Your conversations" scroll={false}><ConversationList /></PageScreen>;
}
