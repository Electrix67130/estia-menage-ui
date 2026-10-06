import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePersistedState } from './usePersistedState';

beforeEach(() => AsyncStorage.clear());

describe('usePersistedState — filtres mémorisés', () => {
  it('démarre sur la valeur par défaut puis prend la valeur persistée', async () => {
    await AsyncStorage.setItem('filters', JSON.stringify({ type: 'check_in' }));
    const { result } = renderHook(() => usePersistedState('filters', { type: '' }));
    expect(result.current[0]).toEqual({ type: '' });
    await waitFor(() => expect(result.current[0]).toEqual({ type: 'check_in' }));
  });

  it('persiste chaque modification et sait revenir au défaut', async () => {
    const { result } = renderHook(() => usePersistedState('view', 'planning'));
    await waitFor(() => expect(result.current[0]).toBe('planning'));
    act(() => result.current[1]('todo'));
    await waitFor(async () => expect(await AsyncStorage.getItem('view')).toBe(JSON.stringify('todo')));
    act(() => result.current[2]());
    expect(result.current[0]).toBe('planning');
  });

  it('ignore une valeur corrompue', async () => {
    await AsyncStorage.setItem('broken', '{pas du json');
    const { result } = renderHook(() => usePersistedState('broken', 42));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current[0]).toBe(42);
  });
});
