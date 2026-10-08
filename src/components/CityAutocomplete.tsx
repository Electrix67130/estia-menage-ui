import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCitySearch, CitySuggestion } from '@/hooks/useCitySearch';
import { useAddressSearch, AddressSuggestion } from '@/hooks/useAddressSearch';
import { countryFlag } from '@/lib/address-search';
import { useKeyboardScroll } from './KeyboardAwareScroll';
import { useTranslation } from '@/contexts/I18nContext';

const DROPDOWN_CLEARANCE = 240;

interface Props {
  city: string;
  postalCode: string;
  address: string;
  onSelect: (city: string, postalCode: string, latitude: number, longitude: number) => void;
  onCityChange: (text: string) => void;
  onAddressSelect: (address: string, latitude: number, longitude: number) => void;
  onAddressChange: (text: string) => void;
}

const CityAutocomplete: React.FC<Props> = ({
  city, postalCode, address,
  onSelect, onCityChange, onAddressSelect, onAddressChange,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const ks = useKeyboardScroll();
  const { t } = useTranslation();
  const [cityFocused, setCityFocused] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);

  const { suggestions: citySuggestions, isLoading: cityLoading } = useCitySearch(city);
  const { suggestions: addressSuggestions, isLoading: addressLoading } = useAddressSearch(address, selectedCity);

  const showCitySuggestions = cityFocused && citySuggestions.length > 0 && city.length >= 2;
  const showAddressSuggestions = addressFocused && addressSuggestions.length > 0 && address.length >= 3 && !!selectedCity;

  const handleCitySelect = useCallback(
    (item: CitySuggestion) => {
      onSelect(item.name, item.postalCode, item.latitude, item.longitude);
      setSelectedCity(item);
      setCityFocused(false);
    },
    [onSelect],
  );

  const handleAddressSelect = useCallback(
    (item: AddressSuggestion) => {
      // Suisse / Luxembourg : le code postal dépend de la rue, il n'est connu qu'ici.
      if (item.postalCode && item.postalCode !== postalCode) {
        onSelect(city, item.postalCode, item.latitude, item.longitude);
      }
      onAddressSelect(item.name, item.latitude, item.longitude);
      setAddressFocused(false);
    },
    [onAddressSelect, onSelect, city, postalCode],
  );

  return (
    <View style={styles.container}>
      {/* Row 1: City + Postal code */}
      <View style={styles.row}>
        <View style={[styles.cityField, { zIndex: 20 }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t('menage.city')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="Nancy"
            placeholderTextColor={colors.placeholder}
            value={city}
            onChangeText={(text) => {
              onCityChange(text);
              if (selectedCity) setSelectedCity(null);
            }}
            onFocus={(e) => {
              setCityFocused(true);
              ks?.scrollToInput((e.nativeEvent as unknown as { target: number }).target, DROPDOWN_CLEARANCE);
            }}
            onBlur={() => setTimeout(() => setCityFocused(false), 200)}
            accessibilityLabel={t('menage.city')}
          />
        </View>
        <View style={styles.cpField}>
          <Text style={[styles.label, { color: colors.text }]}>{t('menage.postalCode')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="54000"
            placeholderTextColor={colors.placeholder}
            value={postalCode}
            editable={false}
            accessibilityLabel={t('menage.postalCode')}
          />
        </View>
      </View>

      {/* City suggestions dropdown */}
      {showCitySuggestions && (
        <View style={[styles.dropdown, styles.cityDropdown, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.md]}>
          {cityLoading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
          {citySuggestions.slice(0, 8).map((item, i) => (
            <TouchableOpacity
              key={`${item.name}-${item.postalCode}-${i}`}
              style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
              onPress={() => handleCitySelect(item)}
            >
              <MapPin size={IconSize.sm} color={colors.primary} />
              <View style={styles.suggestionText}>
                <Text style={[styles.suggestionMain, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.suggestionSub, { color: colors.mutedText }]}>
                  {[countryFlag(item.country), item.postalCode, item.department].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Row 2: Address (shown after city is selected) */}
      {(!!postalCode || !!selectedCity) && (
        <View style={{ zIndex: 10 }}>
          <Text style={[styles.label, { color: colors.text }]}>{t('menage.address')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="12 Rue de la Paix"
            placeholderTextColor={colors.placeholder}
            value={address}
            onChangeText={onAddressChange}
            onFocus={(e) => {
              setAddressFocused(true);
              ks?.scrollToInput((e.nativeEvent as unknown as { target: number }).target, DROPDOWN_CLEARANCE);
            }}
            onBlur={() => setTimeout(() => setAddressFocused(false), 200)}
            accessibilityLabel={t('menage.address')}
          />

          {/* Address suggestions dropdown */}
          {showAddressSuggestions && (
            <View style={[styles.dropdown, styles.addressDropdown, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.md]}>
              {addressLoading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
              {addressSuggestions.slice(0, 8).map((item, i) => (
                <TouchableOpacity
                  key={`${item.label}-${i}`}
                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleAddressSelect(item)}
                >
                  <Navigation size={IconSize.sm} color={colors.primary} />
                  <View style={styles.suggestionText}>
                    <Text style={[styles.suggestionMain, { color: colors.text }]}>
                      {item.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { zIndex: 10 },
  row: { flexDirection: 'row', gap: Spacing.md },
  cityField: { flex: 2 },
  cpField: { flex: 1 },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.md },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cityDropdown: { top: 82, zIndex: 30 },
  addressDropdown: { top: 72, zIndex: 20 },
  loader: { padding: Spacing.sm },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  suggestionText: { flex: 1 },
  suggestionMain: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  suggestionSub: { fontSize: FontSize.xs },
});

export default CityAutocomplete;
