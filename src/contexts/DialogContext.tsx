import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Provider de modals confirm/alert au niveau racine de l'app, à utiliser
 * **à la place de `Alert.alert` natif**. Le natif :
 *  - ne se compose pas correctement par-dessus une `Modal` ouverte (iOS avale
 *    l'alerte ou la bloque derrière) ;
 *  - n'est pas thémable et casse le design system.
 *
 * Usage :
 * ```tsx
 * const { confirm, alert } = useDialog();
 * const ok = await confirm({ title: 'Supprimer ?', destructive: true });
 * if (ok) ...
 * await alert({ title: 'Erreur', message: 'Impossible' });
 * ```
 */
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface AlertOptions {
  title: string;
  message?: string;
  buttonLabel?: string;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Stocke la fonction resolve dans une ref pour éviter une condition de race
  // si confirm()/alert() est appelée plusieurs fois rapidement (la seconde
  // attend la fin de la première via setTimeout).
  const queueRef = useRef<Pending[]>([]);

  const next = useCallback(() => {
    const n = queueRef.current.shift();
    setPending(n ?? null);
  }, []);

  const enqueue = useCallback(
    (p: Pending) => {
      if (pending) {
        queueRef.current.push(p);
      } else {
        setPending(p);
      }
    },
    [pending],
  );

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        enqueue({ kind: 'confirm', opts, resolve });
      }),
    [enqueue],
  );

  const alert = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        enqueue({ kind: 'alert', opts, resolve });
      }),
    [enqueue],
  );

  const handleConfirm = (value: boolean) => {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(value);
    else pending.resolve();
    next();
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <DialogModal pending={pending} onResolve={handleConfirm} />
    </DialogContext.Provider>
  );
}

function DialogModal({
  pending,
  onResolve,
}: {
  pending: Pending | null;
  onResolve: (value: boolean) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const visible = !!pending;
  // Snapshot des opts au moment d'ouvrir pour éviter un flash visuel pendant
  // que la modal se ferme (l'animation de close lit encore les props).
  const [snapshot, setSnapshot] = useState<Pending | null>(null);
  React.useEffect(() => {
    if (pending) setSnapshot(pending);
  }, [pending]);

  if (!snapshot) return null;
  const opts = snapshot.opts;
  const isConfirm = snapshot.kind === 'confirm';
  const isDestructive = isConfirm && (snapshot.opts as ConfirmOptions).destructive;
  const confirmLabel = isConfirm
    ? (snapshot.opts as ConfirmOptions).confirmLabel ?? 'Confirmer'
    : (snapshot.opts as AlertOptions).buttonLabel ?? 'OK';
  const cancelLabel = isConfirm
    ? (snapshot.opts as ConfirmOptions).cancelLabel ?? 'Annuler'
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onResolve(false)}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => (isConfirm ? onResolve(false) : onResolve(true))}
      >
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface }, Shadow.lg]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>{opts.title}</Text>
          {opts.message ? (
            <Text style={[styles.message, { color: colors.text2 }]}>{opts.message}</Text>
          ) : null}

          <View style={styles.actions}>
            {cancelLabel ? (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.itemBackground }]}
                onPress={() => onResolve(false)}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium }}>
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: isDestructive ? colors.red : colors.primary },
              ]}
              onPress={() => onResolve(true)}
              accessibilityRole="button"
            >
              <Text style={{ color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold }}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used inside <DialogProvider>');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  message: { fontSize: FontSize.base, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
});
