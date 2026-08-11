import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ConversationList } from '@/components/conversation-list';
import { PageScreen } from '@/components/page-screen';
import { useAppTheme } from '@/contexts/theme-context';
import { radius } from '@/theme/tokens';

export default function SearchScreen() {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  return (
    <PageScreen title="Search" subtitle="Find a conversation" scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 13, marginBottom: 14 }}>
        <Search color={colors.textMuted} size={19} />
        <TextInput
          accessibilityLabel="Search conversations"
          autoFocus
          placeholder="Search titles"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1, minHeight: 48, color: colors.text, fontSize: 16 }}
        />
      </View>
      <ConversationList query={query} />
    </PageScreen>
  );
}
