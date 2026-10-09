import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { LogOut, User, Sun, Moon, Smartphone, Save, Mail, Phone, Building2, Check, Globe, Lock, KeyRound, X, Camera, Plus, ArrowRightLeft, Bell, FileText, ChevronRight, ExternalLink, Wallet, Search, MapPin, Receipt, Archive, MessageSquare, Trash2 } from 'lucide-react-native';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { DASHBOARD_CREATE_ORG_URL } from '@/constants/Urls';
import { Modal, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import SheetHandle from '@/components/SheetHandle';
import * as ImagePicker from 'expo-image-picker';
import * as Updates from 'expo-updates';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/I18nContext';
import { LOCALES, Locale } from '@/i18n/translations';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateProfile, useUpdatePassword, useSwitchOrganization, useCreateOrganization } from '@/api/hooks/useAuth';
import { useCompanyLookup } from '@/api/hooks/useCompanyLookup';
import { Colors } from '@/constants/Colors';
import AppHeader from '@/components/AppHeader';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { formatDateFr } from '@/lib/date-fr';
import AutoScrollInput from '@/components/AutoScrollInput';
import { useDialog } from '@/contexts/DialogContext';
import BlockedUsersSection from '@/components/BlockedUsersSection';

const THEME_OPTIONS: { mode: ThemeMode; key: 'profile.themeLight' | 'profile.themeDark' | 'profile.themeSystem'; icon: typeof Sun }[] = [
  { mode: 'light', key: 'profile.themeLight', icon: Sun },
  { mode: 'dark', key: 'profile.themeDark', icon: Moon },
  { mode: 'system', key: 'profile.themeSystem', icon: Smartphone },
];

export default function ProfilScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { locale, setLocale, t } = useTranslation();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const isAdmin = user?.role === 'admin';
  const dialog = useDialog();
  const updatePassword = useUpdatePassword();
  const switchOrg = useSwitchOrganization();
  const createOrg = useCreateOrganization();
  const companyLookup = useCompanyLookup();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  const roleLabel = (role: string): string => {
    if (role === 'admin') return t('collab.role.admin');
    if (role === 'prestataire') return t('collab.role.prestataire');
    if (role === 'manager') return t('collab.role.manager');
    if (role === 'client') return t('collab.role.client');
    return role;
  };

  const handleOpenDashboardCreateOrg = async () => {
    setShowCreateOrgModal(false);
    await Linking.openURL(DASHBOARD_CREATE_ORG_URL);
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [providerCompany, setProviderCompany] = useState('');
  const [providerSiret, setProviderSiret] = useState('');
  const [providerVat, setProviderVat] = useState('');
  const [providerAddress, setProviderAddress] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const animatedPasswordModalStyle = useKeyboardAwareModalStyle({ visible: showPasswordModal });
  const animatedCreateOrgModalStyle = useKeyboardAwareModalStyle({ visible: showCreateOrgModal });
  const passwordSwipe = useSwipeToClose(() => {
    setShowPasswordModal(false);
    setPasswordError('');
  }, showPasswordModal);
  const createOrgSwipe = useSwipeToClose(() => setShowCreateOrgModal(false), showCreateOrgModal);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setCompanyName(user.company_name || '');
      setProviderCompany(user.provider_company || '');
      setProviderSiret(user.provider_siret || '');
      setProviderVat(user.provider_vat_number || '');
      setProviderAddress(user.provider_address || '');
    }
  }, [user]);

  const handlePickAvatar = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
    const uploaded = await uploadFile(optimized.uri, `avatar-${user.id}.jpg`, 'image/jpeg');
    await updateProfile.mutateAsync({
      id: user.id,
      body: { avatar_url: uploaded.url, avatar_thumbnail_url: uploaded.thumbnail_url ?? uploaded.url },
    });
  };

  const handleSave = async () => {
    if (!user) return;
    // L'admin gère le nom de l'entreprise de l'org (company_name, propagé) ;
    // le prestataire gère sa propre entreprise (provider_company).
    await updateProfile.mutateAsync({
      id: user.id,
      body: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        ...(user.role === 'admin'
          ? { company_name: companyName.trim() || undefined }
          : {
              provider_company: providerCompany.trim() || null,
              provider_siret: providerSiret.trim() || null,
              provider_vat_number: providerVat.trim() || null,
              provider_address: providerAddress.trim() || null,
            }),
      },
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  // Lookup SIRET → pré-remplit raison sociale, adresse et n° TVA.
  const handleSiretLookup = async () => {
    const siret = providerSiret.replace(/\s/g, '');
    if (!/^\d{14}$/.test(siret)) {
      void dialog.alert({ title: t('profile.siretInvalidTitle'), message: t('profile.siretInvalidBody') });
      return;
    }
    try {
      const r = await companyLookup.mutateAsync(siret);
      setProviderCompany(r.name || providerCompany);
      setProviderAddress(r.address || providerAddress);
      setProviderVat(r.vat_number || providerVat);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('profile.companyNotFound');
      void dialog.alert({ title: t('common.notFound'), message: msg });
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 12 || !/\p{L}/u.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError(t('profile.passwordRules'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }
    try {
      await updatePassword.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      void dialog.alert({ title: t('profile.passwordChangedTitle'), message: t('profile.passwordChangedBody') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setPasswordError(msg.includes('Current') ? t('profile.currentPasswordWrong') : msg);
    }
  };

  const hasChanges = user && (
    firstName !== (user.first_name || '') ||
    lastName !== (user.last_name || '') ||
    email !== (user.email || '') ||
    phone !== (user.phone || '') ||
    (user.role === 'admin'
      ? companyName !== (user.company_name || '')
      : providerCompany !== (user.provider_company || '') ||
        providerSiret !== (user.provider_siret || '') ||
        providerVat !== (user.provider_vat_number || '') ||
        providerAddress !== (user.provider_address || ''))
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
                setRefreshing(false);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >

          {user && (
            <>
              {/* Avatar + email */}
              <View style={[styles.identityCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.sm]}>
                <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                    {user.avatar_url ? (
                      <Image
                        source={{ uri: user.avatar_thumbnail_url ?? user.avatar_url }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {user.first_name[0]}{user.last_name[0]}
                      </Text>
                    )}
                    <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                      <Camera size={12} color="#FFFFFF" />
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.identityInfo}>
                  <Text style={[styles.email, { color: colors.text }]}>{user.email}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.roleText, { color: colors.primary }]}>{roleLabel(user.role)}</Text>
                  </View>
                </View>
              </View>

              {/* Settings — Informations personnelles */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.personalInfo')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.firstName')}</Text>
                    <AutoScrollInput
                      style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                      value={firstName}
                      onChangeText={setFirstName}
                      accessibilityLabel={t('auth.firstName')}
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.lastName')}</Text>
                    <AutoScrollInput
                      style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                      value={lastName}
                      onChangeText={setLastName}
                      accessibilityLabel={t('auth.lastName')}
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.email')}</Text>
                <View style={styles.inputRow}>
                  <Mail size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                  <AutoScrollInput
                    style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t('auth.email')}
                  />
                </View>

                <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.phone')}</Text>
                <View style={styles.inputRow}>
                  <Phone size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                  <AutoScrollInput
                    style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="06 12 34 56 78"
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel={t('auth.phone')}
                  />
                </View>

                {user.role === 'admin' ? (
                  <>
                    <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.company')}</Text>
                    <View style={styles.inputRow}>
                      <Building2 size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                      <AutoScrollInput
                        style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                        value={companyName}
                        onChangeText={setCompanyName}
                        editable
                        placeholder="EIFFAGE, Bouygues..."
                        placeholderTextColor={colors.placeholder}
                        accessibilityLabel={t('auth.company')}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    {/* Entreprise du prestataire — renseignée via SIRET (facturation). */}
                    <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.providerSiret')}</Text>
                    <View style={styles.inputRow}>
                      <Receipt size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                      <AutoScrollInput
                        style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border, paddingRight: 48 }]}
                        value={providerSiret}
                        onChangeText={setProviderSiret}
                        editable
                        keyboardType="number-pad"
                        placeholder={t('profile.siretPlaceholder')}
                        placeholderTextColor={colors.placeholder}
                        accessibilityLabel={t('legal.siret')}
                      />
                      <TouchableOpacity
                        onPress={handleSiretLookup}
                        disabled={companyLookup.isPending}
                        style={styles.siretLookupBtn}
                        accessibilityLabel={t('profile.siretLookupA11y')}
                      >
                        {companyLookup.isPending ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Search size={IconSize.md} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.hint, { color: colors.mutedText }]}>
                      {t('profile.siretLookupHint')}
                    </Text>

                    <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.companyName')}</Text>
                    <View style={styles.inputRow}>
                      <Building2 size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                      <AutoScrollInput
                        style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                        value={providerCompany}
                        onChangeText={setProviderCompany}
                        editable
                        placeholder={t('profile.companyPlaceholder')}
                        placeholderTextColor={colors.placeholder}
                        accessibilityLabel={t('profile.companyName')}
                      />
                    </View>

                    <Text style={[styles.label, { color: colors.text2 }]}>{t('legal.streetAddress')}</Text>
                    <View style={styles.inputRow}>
                      <MapPin size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                      <AutoScrollInput
                        style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                        value={providerAddress}
                        onChangeText={setProviderAddress}
                        editable
                        placeholder={t('profile.companyAddressPlaceholder')}
                        placeholderTextColor={colors.placeholder}
                        accessibilityLabel={t('legal.streetAddress')}
                      />
                    </View>

                    <Text style={[styles.label, { color: colors.text2 }]}>{t('client.vatNumber')}</Text>
                    <View style={styles.inputRow}>
                      <FileText size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                      <AutoScrollInput
                        style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                        value={providerVat}
                        onChangeText={setProviderVat}
                        editable
                        autoCapitalize="characters"
                        placeholder="FR…"
                        placeholderTextColor={colors.placeholder}
                        accessibilityLabel={t('profile.vatA11y')}
                      />
                    </View>
                    <Text style={[styles.hint, { color: colors.mutedText }]}>
                      {t('profile.providerOrgHint')}
                    </Text>
                  </>
                )}

                {hasChanges && (
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: savedFlash ? colors.green : colors.primary }]}
                    onPress={handleSave}
                    disabled={updateProfile.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.save')}
                  >
                    {updateProfile.isPending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : savedFlash ? (
                      <>
                        <Check size={IconSize.md} color="#FFFFFF" />
                        <Text style={styles.saveBtnText}>{t('common.saved')}</Text>
                      </>
                    ) : (
                      <>
                        <Save size={IconSize.md} color="#FFFFFF" />
                        <Text style={styles.saveBtnText}>{t('profile.saveChanges')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Security */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.earningsSection')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.securityBtn, { borderColor: colors.border }]}
                  onPress={() => router.push('/earnings' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.myEarnings')}
                >
                  <Wallet size={IconSize.md} color={colors.primary} />
                  <Text style={[styles.securityBtnText, { color: colors.text }]}>
                    {t('profile.myEarnings')}
                  </Text>
                  <ChevronRight size={IconSize.sm} color={colors.mutedText} />
                </TouchableOpacity>
              </View>

              {isAdmin ? (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.archivesSection')}</Text>
                  <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.securityBtn, { borderColor: colors.border }]}
                      onPress={() => router.push('/(tabs)/archives' as never)}
                      accessibilityRole="button"
                      accessibilityLabel={t('profile.archivedMenages')}
                    >
                      <Archive size={IconSize.md} color={colors.primary} />
                      <Text style={[styles.securityBtnText, { color: colors.text }]}>
                        {t('profile.archivedMenages')}
                      </Text>
                      <ChevronRight size={IconSize.sm} color={colors.mutedText} />
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.securitySection')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.securityBtn, { borderColor: colors.border }]}
                  onPress={() => setShowPasswordModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.changePassword')}
                >
                  <KeyRound size={IconSize.md} color={colors.primary} />
                  <Text style={[styles.securityBtnText, { color: colors.text }]}>
                    {t('profile.changePassword')}
                  </Text>
                </TouchableOpacity>
                {/* Suppression de compte depuis l'app — exigée par l'App Store (5.1.1). */}
                <TouchableOpacity
                  style={[styles.securityBtn, { borderColor: colors.red, marginTop: Spacing.sm }]}
                  onPress={() => router.push('/delete-account' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.deleteAccount')}
                >
                  <Trash2 size={IconSize.md} color={colors.red} />
                  <Text style={[styles.securityBtnText, { color: colors.red }]}>
                    {t('profile.deleteAccount')}
                  </Text>
                  <ChevronRight size={IconSize.sm} color={colors.red} />
                </TouchableOpacity>
              </View>

              <BlockedUsersSection />

              {/* Mes organisations */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.orgsSection')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {(user?.memberships ?? []).map((m) => {
                  const isActive = m.organization_id === user?.active_organization_id;
                  return (
                    <View
                      key={m.organization_id}
                      style={[styles.orgRow, { borderColor: colors.border }]}
                    >
                      <View style={[styles.orgIcon, { backgroundColor: colors.primary + '15' }]}>
                        <Building2 size={IconSize.md} color={colors.primary} />
                      </View>
                      <View style={styles.orgInfo}>
                        <Text style={[styles.orgName, { color: colors.text }]} numberOfLines={1}>
                          {m.organization_name}
                        </Text>
                        <Text style={[styles.orgRole, { color: colors.mutedText }]}>
                          {roleLabel(m.role)}
                        </Text>
                      </View>
                      {isActive ? (
                        <View style={[styles.orgActiveBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Check size={14} color={colors.primary} />
                          <Text style={[styles.orgActiveText, { color: colors.primary }]}>{t('profile.orgCurrent')}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.orgSwitchBtn, { backgroundColor: colors.primary }]}
                          onPress={() => {
                            switchOrg.mutate(m.organization_id, {
                              onError: (err) =>
                                void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('profile.switchFailed') }),
                            });
                          }}
                          disabled={switchOrg.isPending}
                          accessibilityLabel={t('profile.switchOrgA11y', { name: m.organization_name })}
                        >
                          {switchOrg.isPending ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <>
                              <ArrowRightLeft size={14} color="#FFFFFF" />
                              <Text style={styles.orgSwitchText}>{t('profile.switchOrg')}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={[styles.createOrgBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                  onPress={() => setShowCreateOrgModal(true)}
                  accessibilityLabel={t('profile.createOrg')}
                >
                  <Plus size={IconSize.md} color={colors.primary} />
                  <Text style={[styles.createOrgText, { color: colors.primary }]}>
                    {t('profile.createOrg')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Admin — Informations légales */}
              {false && isAdmin && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('legal.sectionTitle')}</Text>
                  <TouchableOpacity
                    style={[styles.settingsCard, styles.legalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {}}
                    accessibilityRole="button"
                    accessibilityLabel={t('legal.openButton')}
                  >
                    <FileText size={IconSize.md} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.legalRowTitle, { color: colors.text }]}>{t('legal.openButton')}</Text>
                      <Text style={[styles.hint, { color: colors.mutedText }]}>{t('legal.openButtonHint')}</Text>
                    </View>
                    <ChevronRight size={IconSize.sm} color={colors.mutedText} />
                  </TouchableOpacity>
                </>
              )}

              {/* Aide & signalements — ouvert à tous : c'est le canal pour
                  remonter un bug ou proposer une amélioration. */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>
                {t('support.section')}
              </Text>
              <TouchableOpacity
                style={[styles.settingsCard, styles.legalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push('/support' as never)}
                accessibilityRole="button"
                accessibilityLabel={t('support.title')}
              >
                <MessageSquare size={IconSize.md} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.legalRowTitle, { color: colors.text }]}>{t('support.title')}</Text>
                  <Text style={[styles.hint, { color: colors.mutedText }]}>{t('support.entryHint')}</Text>
                </View>
                <ChevronRight size={IconSize.sm} color={colors.mutedText} />
              </TouchableOpacity>

              {/* Réglages */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.settingsSection')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.notifRow}
                  onPress={() => router.push('/notification-preferences' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.notifications')}
                >
                  <View style={[styles.notifIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Bell size={IconSize.md} color={colors.primary} />
                  </View>
                  <View style={styles.notifInfo}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>{t('profile.notifications')}</Text>
                    <Text style={[styles.notifHint, { color: colors.mutedText }]}>
                      {t('profile.notificationsHint')}
                    </Text>
                  </View>
                  <ChevronRight size={IconSize.sm} color={colors.mutedText} />
                </TouchableOpacity>
              </View>

              {/* Settings — Apparence */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.appearance')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.theme')}</Text>
                <View style={styles.themeRow}>
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = mode === opt.mode;
                    return (
                      <TouchableOpacity
                        key={opt.mode}
                        style={[
                          styles.themeOption,
                          {
                            backgroundColor: isActive ? colors.primary + '20' : colors.itemBackground,
                            borderColor: isActive ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setMode(opt.mode)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={t(opt.key)}
                      >
                        <Icon size={IconSize.lg} color={isActive ? colors.primary : colors.text2} />
                        <Text style={[styles.themeLabel, { color: isActive ? colors.primary : colors.text2 }]}>
                          {t(opt.key)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Language picker */}
                <Text style={[styles.label, { color: colors.text2, marginTop: Spacing.lg }]}>{t('profile.language')}</Text>
                <View style={styles.langGrid}>
                  {LOCALES.map((loc) => {
                    const isActive = locale === loc.code;
                    return (
                      <TouchableOpacity
                        key={loc.code}
                        style={[
                          styles.langOption,
                          {
                            backgroundColor: isActive ? colors.primary + '20' : colors.itemBackground,
                            borderColor: isActive ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setLocale(loc.code)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={loc.label}
                      >
                        <Text style={styles.langFlag}>{loc.flag}</Text>
                        <Text style={[styles.langLabel, { color: isActive ? colors.primary : colors.text2 }]}>
                          {loc.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Logout */}
              <TouchableOpacity
                style={[styles.logoutBtn, { borderColor: colors.red }]}
                onPress={async () => {
                  const ok = await dialog.confirm({
                    title: t('profile.logout'),
                    message: t('profile.logoutConfirm'),
                    confirmLabel: t('profile.logout'),
                    destructive: true,
                  });
                  if (ok) logout();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('profile.logout')}
              >
                <LogOut size={IconSize.md} color={colors.red} />
                <Text style={[styles.logoutText, { color: colors.red }]}>{t('profile.logout')}</Text>
              </TouchableOpacity>

              {/* Version + provenance du bundle (build natif vs OTA) — permet de
                  vérifier qu'une mise à jour OTA a bien été appliquée. */}
              <Text style={[styles.versionText, { color: colors.mutedText }]}>
                v{Updates.runtimeVersion ?? '?'}
                {' · '}
                {Updates.isEmbeddedLaunch
                  ? t('profile.buildNative')
                  : Updates.createdAt
                    ? t('profile.buildOta', {
                        date: formatDateFr(Updates.createdAt, 'short'),
                        time: formatDateFr(Updates.createdAt, 'time'),
                      })
                    : 'OTA'}
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Change password modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <GestureHandlerRootView style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setShowPasswordModal(false);
              setPasswordError('');
            }}
          />
            <Animated.View
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
                animatedPasswordModalStyle,
                passwordSwipe.animatedStyle,
              ]}
            >
              <SheetHandle gesture={passwordSwipe.gesture} />
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.sm }]}>{t('profile.changePassword')}</Text>

            <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.currentPassword')}</Text>
            <AutoScrollInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              accessibilityLabel={t('profile.currentPassword')}
            />

            <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.newPassword')}</Text>
            <AutoScrollInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder={t('profile.newPasswordPlaceholder')}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t('profile.newPassword')}
            />

            <Text style={[styles.label, { color: colors.text2 }]}>{t('common.confirm')}</Text>
            <AutoScrollInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              accessibilityLabel={t('profile.confirmPasswordA11y')}
            />

            {passwordError ? (
              <Text style={[styles.error, { color: colors.red }]}>{passwordError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: Spacing.lg }]}
              onPress={handleChangePassword}
              disabled={updatePassword.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('common.validate')}
            >
              {updatePassword.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>{t('profile.submitPassword')}</Text>
              )}
            </TouchableOpacity>
            </Animated.View>
        </GestureHandlerRootView>
      </Modal>

      {/* Create organization modal */}
      <Modal visible={showCreateOrgModal} transparent animationType="slide">
        <GestureHandlerRootView style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreateOrgModal(false)} />
            <Animated.View
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
                animatedCreateOrgModalStyle,
                createOrgSwipe.animatedStyle,
              ]}
            >
              <SheetHandle gesture={createOrgSwipe.gesture} />
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.sm }]}>{t('profile.newOrgTitle')}</Text>

            <View style={[styles.dashRedirectBubble, { backgroundColor: colors.primary + '15' }]}>
              <Building2 size={IconSize.lg} color={colors.primary} />
            </View>
            <Text style={[styles.dashRedirectTitle, { color: colors.text }]}>
              {t('profile.createOrgOnDashboard')}
            </Text>
            <Text style={[styles.dashRedirectBody, { color: colors.text2 }]}>
              {t('profile.createOrgBody')}
            </Text>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: Spacing.lg, flexDirection: 'row', gap: Spacing.sm }]}
              onPress={handleOpenDashboardCreateOrg}
              accessibilityRole="link"
              accessibilityLabel={t('profile.openDashboardA11y')}
            >
              <ExternalLink size={IconSize.sm} color="#FFFFFF" />
              <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>{t('profile.openDashboard')}</Text>
            </TouchableOpacity>
            </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl * 2, gap: Spacing.md },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  avatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  identityInfo: { flex: 1, gap: Spacing.xs },
  email: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginTop: Spacing.lg, marginLeft: Spacing.sm },

  settingsCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  legalRowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  dashRedirectBubble: {
    height: 56,
    width: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  dashRedirectTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginTop: Spacing.md },
  dashRedirectBody: { fontSize: FontSize.base, lineHeight: 22, marginTop: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfField: { flex: 1 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.sm },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.xs, fontStyle: 'italic' },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, position: 'relative' },
  siretLookupBtn: { position: 'absolute', right: Spacing.sm, height: 44, width: 36, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  inputIcon: { position: 'absolute', left: Spacing.md, zIndex: 1 },
  inputWithIcon: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingLeft: 44,
    paddingRight: Spacing.md,
    fontSize: FontSize.base,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },


  themeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  themeLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: 130,
  },
  langFlag: { fontSize: 20 },
  langLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginTop: Spacing.xl,
  },
  logoutText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  versionText: { textAlign: 'center', fontSize: FontSize.xs, marginTop: Spacing.md },

  securityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  securityBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.medium, flex: 1 },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  notifIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  notifInfo: { flex: 1 },
  notifTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  notifHint: { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.4 },

  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  orgIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  orgInfo: { flex: 1 },
  orgName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  orgRole: { fontSize: FontSize.xs, marginTop: 2 },
  orgActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  orgActiveText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  orgUnreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgUnreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: FontWeight.bold },
  orgSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  orgSwitchText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  createOrgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.sm,
  },
  createOrgText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },

  error: { fontSize: FontSize.sm, marginTop: Spacing.sm },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xl, gap: Spacing.xs },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
});
