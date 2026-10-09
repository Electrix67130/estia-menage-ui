import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, FlatList, StyleSheet, Modal, Keyboard, Platform, RefreshControl, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Reanimated, { useAnimatedStyle, ZoomIn, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { Send, Trash2, Pencil, X, Flag, Reply, Ban } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useMentionable,
  useToggleReaction,
} from '@/api/hooks/useComments';
import { useBlockUser } from '@/api/hooks/useBlocks';
import { REACTION_EMOJIS, type ReactionEmoji } from '@/constants/reactions';
import { useDialog } from '@/contexts/DialogContext';
import { useUnreadCounts, useMarkTabViewed } from '@/api/hooks/useMenageViews';
import { useAuth } from '@/contexts/AuthContext';
import type { Comment } from '@/api/types';
import { formatDateFr } from '@/lib/date-fr';
import { useTranslation } from '@/contexts/I18nContext';
import ReportSheet, { type ReportTargetRef } from '@/components/ReportSheet';
import {
  activeMentionQuery,
  filterMentionCandidates,
  insertMention,
  mentionedIdsInText,
  mentionName,
  splitMentions,
  type MentionCandidate,
} from '@/lib/mentions';

type CommentWithAuthor = Comment & { first_name: string; last_name: string; avatar_url?: string };

interface Props {
  menageId: string;
  /** 'general' = uniquement messages hors-etape ; uuid = messages d'une etape ; undefined = tous */
  sectionFilter?: string | 'general';
  readonly?: boolean;
  /** Contenu rendu au-dessus de la liste des messages, scrolle avec elle. */
  listHeader?: React.ReactNode;
  /** Callback declenche au focus du champ de saisie (ex. pour masquer un header au-dessus). */
  onInputFocus?: () => void;
  /** Callback au blur du champ (pour restaurer le header masqué). */
  onInputBlur?: () => void;
  /** Distance entre le haut de l'écran et le haut de cette vue (header + onglets
   *  au-dessus). Requis par KeyboardAvoidingView pour bien remonter l'input. */
  keyboardVerticalOffset?: number;
}

const CommentThread: React.FC<Props> = ({ menageId, sectionFilter, readonly, listHeader, onInputFocus, onInputBlur }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data, isLoading, refetch, isRefetching } = useComments(menageId, sectionFilter);
  const createMutation = useCreateComment();
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const reactMutation = useToggleReaction(menageId);
  const blockMutation = useBlockUser();
  const dialog = useDialog();

  // Pastille « non lu » : on traite uniquement la discussion générale (onglet
  // `comments`). On fige le seuil de lecture à l'ouverture (pour garder les
  // pastilles visibles pendant la lecture) puis on marque l'onglet comme lu.
  const isGeneralThread = !sectionFilter || sectionFilter === 'general';
  const unreadCounts = useUnreadCounts(isGeneralThread ? menageId : undefined);
  const markViewed = useMarkTabViewed();
  const [readThreshold, setReadThreshold] = useState<string | null | undefined>(undefined);
  const markedRef = useRef(false);
  useEffect(() => {
    if (!isGeneralThread || !unreadCounts.data) return;
    setReadThreshold((prev) => (prev === undefined ? unreadCounts.data!.comments_last_viewed_at : prev));
    if (!markedRef.current) {
      markedRef.current = true;
      markViewed.mutate({ menage_id: menageId, tab: 'comments' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneralThread, unreadCounts.data, menageId]);

  const [text, setText] = useState('');
  // Position du curseur : la liste « @ » se base sur ce qui est tapé juste avant.
  const [cursor, setCursor] = useState(0);
  const mentionableQuery = useMentionable(readonly ? undefined : menageId);
  const mentionable = useMemo(() => mentionableQuery.data ?? [], [mentionableQuery.data]);
  const activeMention = activeMentionQuery(text, Math.min(cursor, text.length));
  const mentionSuggestions = activeMention ? filterMentionCandidates(mentionable, activeMention.query) : [];
  const [selectedComment, setSelectedComment] = useState<CommentWithAuthor | null>(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  // Message auquel on répond (barre « Réponse à … » au-dessus du champ).
  const [replyTo, setReplyTo] = useState<CommentWithAuthor | null>(null);
  // Contenu d'un autre utilisateur en cours de signalement (App Store 1.2).
  const [reportTarget, setReportTarget] = useState<ReportTargetRef | null>(null);
  // Message brièvement mis en avant après un saut depuis une citation.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const animatedEditModalStyle = useKeyboardAwareModalStyle({ visible: isEditing });

  // Montée déterministe et fluide : on réduit la hauteur du bloc par le bas de la
  // hauteur exacte du clavier (padding animé). L'input (en bas) se colle ainsi au
  // clavier tandis que la liste reste visible au-dessus (juste plus courte).
  // `height.value` est négatif quand le clavier est ouvert → on prend l'opposé.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const chatAnimStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -keyboardHeight.value),
  }));

  const flatListRef = useRef<FlatList>(null);
  // Auto-scroll only quand l'utilisateur est deja proche du bas. Si il a scrolle pour relire
  // d'anciens messages, on respecte sa position (clavier qui s'ouvre, nouveau message, etc.).
  const isNearBottomRef = useRef(true);
  // Premier rendu : on aligne la liste sur le dernier message peu importe la position.
  const isFirstContentLayoutRef = useRef(true);
  const NEAR_BOTTOM_THRESHOLD = 80;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  }, []);

  // La montée au-dessus du clavier est gérée par <KeyboardAvoidingView> (lib
  // react-native-keyboard-controller, robuste cross-device/edge-to-edge). Ici on
  // ne gère QUE le suivi de conversation : si on était déjà en bas, on recolle au
  // dernier message à l'ouverture du clavier.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSub = Keyboard.addListener(showEvent, () => {
      if (isNearBottomRef.current) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });
    return () => showSub.remove();
  }, []);

  const handleSend = useCallback(async () => {
    if (!text.trim()) return;
    const section_id = sectionFilter && sectionFilter !== 'general' ? sectionFilter : null;
    await createMutation.mutateAsync({
      menage_id: menageId,
      section_id,
      content: text.trim(),
      mentioned_user_ids: mentionedIdsInText(text, mentionable),
      reply_to_id: replyTo?.id ?? null,
    });
    setText('');
    setCursor(0);
    setReplyTo(null);
    // Envoi : on force le scroll pour que l'utilisateur voie son message.
    isNearBottomRef.current = true;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, [text, menageId, sectionFilter, createMutation, mentionable, replyTo]);

  const handlePickMention = useCallback(
    (candidate: MentionCandidate) => {
      if (!activeMention) return;
      const next = insertMention(text, activeMention.start, Math.min(cursor, text.length), candidate);
      setText(next.text);
      setCursor(next.cursor);
    },
    [text, cursor, activeMention],
  );

  const handleDelete = useCallback(() => {
    if (!selectedComment) return;
    deleteMutation.mutate(selectedComment.id);
    setSelectedComment(null);
  }, [selectedComment, deleteMutation]);

  const authorName = useCallback(
    (c: { author_id: string; first_name: string; last_name: string }) =>
      c.author_id === user?.id ? t('comments.you') : `${c.first_name} ${c.last_name}`,
    [user, t],
  );

  const handleStartReport = useCallback(() => {
    if (!selectedComment) return;
    const c = selectedComment;
    setSelectedComment(null);
    setReportTarget({ type: 'comment', id: c.id, label: `${authorName(c)} : ${c.content}` });
  }, [selectedComment, authorName]);

  const handleStartReply = useCallback(() => {
    if (!selectedComment) return;
    setReplyTo(selectedComment);
    setSelectedComment(null);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [selectedComment]);

  const handleReact = useCallback(
    (comment: CommentWithAuthor, emoji: ReactionEmoji) => {
      reactMutation.mutate({ id: comment.id, emoji });
    },
    [reactMutation],
  );

  const handleBlock = useCallback(async () => {
    if (!selectedComment) return;
    const c = selectedComment;
    const name = `${c.first_name} ${c.last_name}`;
    setSelectedComment(null);
    const ok = await dialog.confirm({
      title: t('block.confirmTitle', { name }),
      message: t('block.confirmBody'),
      confirmLabel: t('block.action'),
      destructive: true,
    });
    if (ok) blockMutation.mutate(c.author_id);
  }, [selectedComment, dialog, t, blockMutation]);

  const comments = useMemo(() => (data?.data ?? []) as CommentWithAuthor[], [data]);

  /** Saute au message cité et le met en avant un instant. */
  const scrollToComment = useCallback(
    (id: string) => {
      const index = comments.findIndex((m) => m.id === id);
      if (index < 0) return;
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId((cur) => (cur === id ? null : cur)), 1600);
    },
    [comments],
  );

  const handleStartEdit = useCallback(() => {
    if (!selectedComment) return;
    setEditText(selectedComment.content);
    setIsEditing(true);
  }, [selectedComment]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedComment || !editText.trim()) return;
    await updateMutation.mutateAsync({
      id: selectedComment.id,
      content: editText.trim(),
      mentioned_user_ids: mentionedIdsInText(editText, mentionable),
    });
    setIsEditing(false);
    setSelectedComment(null);
    setEditText('');
  }, [selectedComment, editText, updateMutation, mentionable]);

  const formatTime = (date: string) => formatDateFr(date, 'dayShortTime');

  const renderItem = useCallback(
    ({ item }: { item: CommentWithAuthor }) => {
      const isOwn = item.author_id === user?.id;
      // Appui long : modifier/supprimer ses propres messages, signaler ceux des autres.
      const canLongPress = !readonly;
      const isUnread =
        !isOwn &&
        readThreshold !== undefined &&
        (readThreshold === null ||
          new Date(item.created_at).getTime() > new Date(readThreshold).getTime());
      const highlighted = highlightedId === item.id;
      const reactions = item.reactions ?? [];
      return (
        <View>
          <TouchableOpacity
            activeOpacity={canLongPress ? 0.7 : 1}
            onPress={() => Keyboard.dismiss()}
            onLongPress={canLongPress ? () => setSelectedComment(item) : undefined}
            delayLongPress={300}
            style={[
              styles.bubble,
              { backgroundColor: isOwn ? colors.primary + '15' : colors.itemBackground },
              highlighted ? { borderWidth: 1.5, borderColor: colors.primary } : null,
            ]}
          >
            <View style={styles.bubbleHeader}>
              <View style={styles.authorRow}>
                {isUnread ? (
                  <View
                    style={[styles.unreadDot, { backgroundColor: colors.red }]}
                    accessibilityLabel={t('comments.unreadA11y')}
                  />
                ) : null}
                <Text style={[styles.author, { color: colors.primary }]}>{authorName(item)}</Text>
              </View>
              <Text style={[styles.time, { color: colors.mutedText }]}>{formatTime(item.created_at)}</Text>
            </View>

            {item.reply_to ? (
              <Pressable
                onPress={() => scrollToComment(item.reply_to!.id)}
                style={[styles.quote, { borderLeftColor: colors.primary, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('comments.replyingTo', { name: authorName(item.reply_to) })}
              >
                <Text style={[styles.quoteAuthor, { color: colors.primary }]} numberOfLines={1}>
                  {authorName(item.reply_to)}
                </Text>
                <Text style={[styles.quoteText, { color: colors.text2 }]} numberOfLines={2}>
                  {item.reply_to.content}
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.content, { color: colors.text }]}>
              {splitMentions(item.content, item.mentions).map((segment, i) =>
                segment.mention ? (
                  <Text key={i} style={[styles.mention, { color: colors.primary }]}>
                    {segment.text}
                  </Text>
                ) : (
                  segment.text
                ),
              )}
            </Text>
          </TouchableOpacity>

          {reactions.length > 0 ? (
            <Reanimated.View style={styles.reactionRow} layout={LinearTransition.springify().damping(18)}>
              {reactions.map((r) => (
                <Reanimated.View
                  key={r.emoji}
                  entering={ZoomIn.springify().damping(12)}
                  exiting={FadeOut.duration(120)}
                  layout={LinearTransition}
                >
                  <Pressable
                    onPress={() => (!readonly ? handleReact(item, r.emoji) : undefined)}
                    disabled={readonly}
                    style={[
                      styles.reactionChip,
                      {
                        backgroundColor: r.mine ? colors.primary + '25' : colors.surface,
                        borderColor: r.mine ? colors.primary : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.emoji} ${r.count}`}
                    accessibilityState={{ selected: r.mine }}
                  >
                    <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactionCount, { color: r.mine ? colors.primary : colors.text2 }]}>{r.count}</Text>
                  </Pressable>
                </Reanimated.View>
              ))}
            </Reanimated.View>
          ) : null}
        </View>
      );
    },
    [user, colors, readThreshold, readonly, t, highlightedId, authorName, handleReact, scrollToComment],
  );

  return (
    <>
      <Reanimated.View style={[styles.container, chatAnimStyle]}>
        <Pressable style={styles.flex} onPress={() => Keyboard.dismiss()}>
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            extraData={highlightedId}
            onScrollToIndexFailed={({ index }) => {
              // La cible n'est pas encore mesurée : on s'en approche, puis on réessaie.
              flatListRef.current?.scrollToOffset({ offset: index * 80, animated: true });
              setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 250);
            }}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              // Premier rendu : aligne sur le dernier message. Apres, on suit la conversation
              // uniquement si l'utilisateur est deja proche du bas — sinon il lit d'anciens
              // messages, on ne le fait pas sauter.
              if (isFirstContentLayoutRef.current || isNearBottomRef.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
                isFirstContentLayoutRef.current = false;
              }
            }}
            ListHeaderComponent={listHeader as React.ReactElement | null}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              !isLoading ? (
                <Text style={[styles.empty, { color: colors.mutedText }]}>{t('comments.empty')}</Text>
              ) : null
            }
          />
        </Pressable>

        {!readonly && replyTo ? (
          <Reanimated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(120)}
            style={[styles.replyBar, { borderLeftColor: colors.primary, backgroundColor: colors.itemBackground }]}
          >
            <Reply size={IconSize.sm} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={[styles.quoteAuthor, { color: colors.primary }]} numberOfLines={1}>
                {t('comments.replyingTo', { name: authorName(replyTo) })}
              </Text>
              <Text style={[styles.quoteText, { color: colors.text2 }]} numberOfLines={1}>
                {replyTo.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setReplyTo(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <X size={IconSize.sm} color={colors.text2} />
            </TouchableOpacity>
          </Reanimated.View>
        ) : null}

        {!readonly && mentionSuggestions.length > 0 && (
          <View
            style={[styles.mentionList, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
            accessibilityLabel={t('comments.mention')}
          >
            {mentionSuggestions.map((candidate) => (
              <TouchableOpacity
                key={candidate.id}
                style={styles.mentionRow}
                onPress={() => handlePickMention(candidate)}
                accessibilityRole="button"
                accessibilityLabel={`${t('comments.mention')} ${mentionName(candidate)}`}
              >
                <View style={[styles.mentionAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.mentionInitials, { color: colors.primary }]}>
                    {`${candidate.first_name.charAt(0)}${candidate.last_name.charAt(0)}`.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.mentionRowName, { color: colors.text }]} numberOfLines={1}>
                  {mentionName(candidate)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!readonly && <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={t('comments.placeholder')}
            placeholderTextColor={colors.placeholder}
            value={text}
            onChangeText={setText}
            onSelectionChange={(e) => setCursor(e.nativeEvent.selection.start)}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            multiline
            accessibilityLabel={t('comments.writeA11y')}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.itemBackground }]}
            onPress={handleSend}
            disabled={!text.trim() || createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('common.send')}
          >
            <Send size={IconSize.md} color={text.trim() ? '#FFFFFF' : colors.mutedText} />
          </TouchableOpacity>
        </View>}
      </Reanimated.View>

      {/* Action sheet */}
      <Modal visible={!!selectedComment && !isEditing} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedComment(null)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            {selectedComment && (
              <>
                <View style={styles.reactionPicker} accessibilityLabel={t('comments.react')}>
                  {REACTION_EMOJIS.map((emoji, i) => {
                    const mine = selectedComment.reactions?.some((r) => r.emoji === emoji && r.mine);
                    return (
                      <Reanimated.View key={emoji} entering={ZoomIn.delay(i * 30).springify().damping(11)}>
                        <Pressable
                          onPress={() => {
                            handleReact(selectedComment, emoji);
                            setSelectedComment(null);
                          }}
                          style={({ pressed }) => [
                            styles.reactionPickerItem,
                            {
                              backgroundColor: mine ? colors.primary + '25' : colors.itemBackground,
                              transform: [{ scale: pressed ? 1.25 : 1 }],
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={emoji}
                          accessibilityState={{ selected: !!mine }}
                        >
                          <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                        </Pressable>
                      </Reanimated.View>
                    );
                  })}
                </View>

                <Text style={[styles.actionSheetPreview, { color: colors.text }]} numberOfLines={2}>
                  {selectedComment.content}
                </Text>
                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                <TouchableOpacity style={styles.actionRow} onPress={handleStartReply} accessibilityRole="button">
                  <Reply size={IconSize.lg} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{t('comments.reply')}</Text>
                </TouchableOpacity>

                {selectedComment.author_id === user?.id ? (
                  <>
                    <TouchableOpacity style={styles.actionRow} onPress={handleStartEdit} accessibilityRole="button">
                      <Pencil size={IconSize.lg} color={colors.primary} />
                      <Text style={[styles.actionLabel, { color: colors.text }]}>{t('common.edit')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={handleDelete} accessibilityRole="button">
                      <Trash2 size={IconSize.lg} color={colors.red} />
                      <Text style={[styles.actionLabel, { color: colors.red }]}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // Message d'un autre : le signaler (aux admins) ou bloquer son auteur.
                  <>
                    <TouchableOpacity style={styles.actionRow} onPress={handleStartReport} accessibilityRole="button">
                      <Flag size={IconSize.lg} color={colors.red} />
                      <Text style={[styles.actionLabel, { color: colors.red }]}>{t('comments.report')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={handleBlock} accessibilityRole="button">
                      <Ban size={IconSize.lg} color={colors.text2} />
                      <Text style={[styles.actionLabel, { color: colors.text }]}>
                        {t('block.actionNamed', { name: `${selectedComment.first_name} ${selectedComment.last_name}` })}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Signalement d'un message d'un autre utilisateur */}
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />

      {/* Edit modal */}
      <Modal visible={isEditing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Reanimated.View style={[styles.editSheet, { backgroundColor: colors.surface }, animatedEditModalStyle]}>
            <View style={styles.editHeader}>
              <Text style={[styles.editTitle, { color: colors.text }]}>{t('comments.editTitle')}</Text>
              <TouchableOpacity onPress={() => { setIsEditing(false); setSelectedComment(null); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              accessibilityLabel={t('comments.editTitle')}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: editText.trim() ? colors.primary : colors.itemBackground }]}
              onPress={handleSaveEdit}
              disabled={!editText.trim() || updateMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('comments.save')}
            >
              <Text style={[styles.saveBtnText, { color: editText.trim() ? '#FFFFFF' : colors.mutedText }]}>
                {t('comments.save')}
              </Text>
            </TouchableOpacity>
          </Reanimated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  bubble: { borderRadius: Radius.lg, padding: Spacing.md },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  author: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  time: { fontSize: FontSize.xs },
  content: { fontSize: FontSize.base, lineHeight: 20 },
  mention: { fontWeight: FontWeight.semibold },
  quote: { borderLeftWidth: 3, borderRadius: Radius.sm, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  quoteAuthor: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  quoteText: { fontSize: FontSize.sm },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: -Spacing.xs, marginLeft: Spacing.sm },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  reactionEmoji: { fontSize: 14, lineHeight: 18 },
  reactionCount: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderLeftWidth: 3,
    borderRadius: Radius.sm,
  },
  reactionPicker: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  reactionPickerItem: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reactionPickerEmoji: { fontSize: 22, lineHeight: 28 },
  mentionList: { borderTopWidth: 1, paddingVertical: Spacing.xs },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  mentionAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mentionInitials: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  mentionRowName: { flex: 1, fontSize: FontSize.base },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  actionSheet: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  actionSheetPreview: { fontSize: FontSize.base, marginBottom: Spacing.md },
  separator: { height: 1, marginVertical: Spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  actionLabel: { fontSize: FontSize.lg },
  cancelLabel: { fontSize: FontSize.lg, textAlign: 'center', width: '100%' },
  editSheet: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  editTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  editInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    textAlignVertical: 'top',
  },
  saveBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  saveBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
});

export default CommentThread;
