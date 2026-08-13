import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Download, Share2, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Share, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { type GeneratedImage, listGeneratedImages } from '@/services/security';
import { radius } from '@/theme/tokens';
import { workspaceService } from '@/services/workspace';
import { useLocalSearchParams } from 'expo-router';

export default function ImagesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { colors } = useAppTheme();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selected, setSelected] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await listGeneratedImages(40, 0, projectId); setImages(result.images); setHasMore(result.hasMore); setError(null); }
    catch (caught) { setError(friendlyError(caught, 'Your images could not be loaded.')); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  const loadMore = async () => {
    setLoadingMore(true);
    try { const result = await listGeneratedImages(40, images.length, projectId); setImages((items) => [...items, ...result.images]); setHasMore(result.hasMore); }
    catch (caught) { setError(friendlyError(caught, 'More images could not be loaded.')); }
    finally { setLoadingMore(false); }
  };

  const shareImage = async (image: GeneratedImage, saveCopy = false) => {
    if (!image.signedUrl) return;
    setSharing(true); setError(null);
    try {
      if (saveCopy && FileSystem.cacheDirectory && await Sharing.isAvailableAsync()) {
        const destination = `${FileSystem.cacheDirectory}jela-image-${image.id}.png`;
        const download = await FileSystem.downloadAsync(image.signedUrl, destination);
        await Sharing.shareAsync(download.uri, { mimeType: 'image/png', dialogTitle: 'Save Jela AI image' });
      } else {
        await Share.share({ title: 'Created with Jela AI', message: image.prompt, url: image.signedUrl });
      }
    } catch (caught) { setError(friendlyError(caught, 'The image could not be shared.')); }
    finally { setSharing(false); }
  };
  const removeImage = (image: GeneratedImage) => Alert.alert('Delete image?', 'The private image and its stored file will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void workspaceService.deleteGeneratedImage(image.id).then(() => { setSelected(null); return load(); }).catch((caught) => setError(friendlyError(caught, 'The image could not be deleted.'))) }]);

  return (
    <PageScreen title="My images" subtitle="Private images created with Jela AI">
      {loading ? <LoadingState /> : error && !images.length ? <ErrorState message={error} onRetry={() => void load()} /> : !images.length ? (
        <EmptyState title="No generated images yet" message="Open a chat, choose Create image, and describe what you want Jela to make." />
      ) : (
        <View style={{ gap: 14 }}>
          {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {images.map((image) => <Pressable key={image.id} accessibilityRole="button" accessibilityLabel={`Open image: ${image.prompt}`} onPress={() => setSelected(image)} style={{ width: '48%', minWidth: 150, flexGrow: 1 }}>
              <Image source={{ uri: image.signedUrl ?? undefined }} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.surface }} contentFit="cover" transition={220} />
              <AppText variant="caption" numberOfLines={2} style={{ marginTop: 7 }}>{image.prompt}</AppText>
            </Pressable>)}
          </View>
          {hasMore ? <Button variant="secondary" loading={loadingMore} onPress={() => void loadMore()}>Load more images</Button> : null}
        </View>
      )}
      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, padding: 18, justifyContent: 'center' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 12 }}>
            <Pressable accessibilityLabel="Close image" onPress={() => setSelected(null)} style={{ alignSelf: 'flex-end', padding: 4 }}><X color={colors.text} /></Pressable>
            {selected ? <Image source={{ uri: selected.signedUrl ?? undefined }} style={{ width: '100%', aspectRatio: selected.width / selected.height, maxHeight: 560, borderRadius: radius.md }} contentFit="contain" /> : null}
            {selected ? <AppText tone="muted">{selected.prompt}</AppText> : null}
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <View style={{ flex: 1 }}><Button fullWidth variant="secondary" icon={<Share2 color={colors.text} size={17} />} loading={sharing} onPress={() => selected && void shareImage(selected)}>Share</Button></View>
              <View style={{ flex: 1 }}><Button fullWidth icon={<Download color="#FFFFFF" size={17} />} loading={sharing} onPress={() => selected && void shareImage(selected, true)}>Save</Button></View>
            </View>
            {selected ? <Button variant="danger" icon={<Trash2 color="#FFFFFF" size={17} />} onPress={() => removeImage(selected)}>Delete Image</Button> : null}
          </View>
        </View>
      </Modal>
    </PageScreen>
  );
}
