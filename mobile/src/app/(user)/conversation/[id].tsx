import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/components/chat-screen';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen initialConversationId={id} />;
}
