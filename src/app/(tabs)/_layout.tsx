import React from 'react';
import { Tabs } from 'expo-router';
import { Sparkles, Home, Users, UserCircle, CalendarDays } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSize } from '@/constants/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadSummary } from '@/api/hooks/useMenageViews';
import { useTranslation } from '@/contexts/I18nContext';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPrestataire = user?.role === 'prestataire';
  // Total des non-lus (tous ménages) → pastille sur l'onglet "Ménages".
  const byMenage = useUnreadSummary(!!user).data?.by_menage ?? {};
  const totalUnread = Object.values(byMenage).reduce((sum, n) => sum + n, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('prestation.title'),
          tabBarIcon: ({ color }) => <Sparkles size={IconSize.lg} color={color} />,
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.red, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="logements"
        options={{
          title: 'Logements',
          tabBarIcon: ({ color }) => <Home size={IconSize.lg} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          // Le calendrier vit maintenant DANS l'onglet "Dispos" (toggle
          // list/calendar en haut à droite), à la fois pour prestataire et
          // admin. On masque cet onglet — la route reste accessible
          // directement via /(tabs)/calendar (réutilisée depuis Dispos).
          title: 'Calendrier',
          tabBarIcon: ({ color }) => <CalendarDays size={IconSize.lg} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="collaborateurs"
        options={{
          title: 'Équipe',
          tabBarIcon: ({ color }) => <Users size={IconSize.lg} color={color} />,
          // Masqué pour clients ET prestataires : seul l'admin gère l'équipe.
          href: isPrestataire ? null : '/(tabs)/collaborateurs',
        }}
      />
      <Tabs.Screen
        name="mes-disponibilites"
        options={{
          title: 'Calendrier',
          tabBarIcon: ({ color }) => <CalendarDays size={IconSize.lg} color={color} />,
          // Vue calendrier (mois) pour tout le monde sauf client. La liste
          // dispo "Présent/Absent" du presta vit maintenant dans l'onglet
          // "Ménages" (index).
          href: '/(tabs)/mes-disponibilites' as never,
        }}
      />
      <Tabs.Screen
        name="archives"
        options={{
          href: null, // masqué
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <UserCircle size={IconSize.lg} color={color} />,
        }}
      />
    </Tabs>
  );
}
