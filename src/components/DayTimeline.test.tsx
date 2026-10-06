import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, type RenderResult } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AgendaRow, DayTimeline, statusKey } from './DayTimeline';
import { Colors } from '@/constants/Colors';
import { translate } from '@/i18n/runtime';
import { makeMenage, renderWithProviders } from '@/test-utils/render';

interface EventBox {
  top: number;
  height: number;
  left: string;
  width: string;
}

interface JsonNode {
  props?: { style?: unknown };
  children?: (JsonNode | string)[] | null;
}

/** Récupère les blocs positionnés (top/height/left/width) de la timeline. */
function eventBoxes(utils: RenderResult): EventBox[] {
  const out: EventBox[] = [];
  const visit = (node: JsonNode | string | null) => {
    if (!node || typeof node === 'string') return;
    const style = StyleSheet.flatten(node.props?.style as Parameters<typeof StyleSheet.flatten>[0]) as Record<string, unknown> | undefined;
    if (style && typeof style.top === 'number' && typeof style.width === 'string' && typeof style.left === 'string') {
      out.push({ top: style.top, height: style.height as number, left: style.left, width: style.width });
    }
    node.children?.forEach(visit);
  };
  const json = utils.toJSON();
  (Array.isArray(json) ? json : [json]).forEach((n) => visit(n as JsonNode));
  return out;
}

describe('statusKey', () => {
  it('« terminé » se lit « Terminé » dans l’agenda (pas « À valider »)', () => {
    expect(translate(statusKey('termine'))).toBe('Terminé');
    expect(translate(statusKey('a_venir'))).toBe('À venir');
  });
});

describe('AgendaRow — ligne agenda', () => {
  it('heure, logement, type, prestataire · statut', () => {
    const { getByText } = renderWithProviders(
      <AgendaRow menage={makeMenage({ horaire_prevu: '09:30:00' })} colors={Colors.light} onPress={() => undefined} />,
    );
    expect(getByText('09:30')).toBeTruthy();
    expect(getByText('Villa Azur')).toBeTruthy();
    expect(getByText(translate('prestationType.menage'))).toBeTruthy();
    expect(getByText(`${translate('common.unassigned')} · ${translate('menage.statusUpcoming')}`)).toBeTruthy();
  });

  it('« Non pointé » sur un jour passé sans pointage, tiret sans heure', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithProviders(
      <AgendaRow
        menage={makeMenage({ horaire_prevu: null, needs_attention: true, prestataire_user_id: 'u1', prestataire_first_name: 'Marie' })}
        colors={Colors.light}
        onPress={onPress}
      />,
    );
    expect(getByText('—')).toBeTruthy();
    expect(getByText(translate('menage.statusNotClockedIn'))).toBeTruthy();
    expect(getByText(`Marie · ${translate('menage.statusUpcoming')}`)).toBeTruthy();
    fireEvent.press(getByText('Villa Azur'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('DayTimeline — positionnement par horaire et durée', () => {
  it('grille 08:00 → 20:00 par défaut, même sans prestation', () => {
    const { getByText, queryByText } = renderWithProviders(<DayTimeline items={[]} colors={Colors.light} onPressItem={() => undefined} />);
    expect(getByText('08:00')).toBeTruthy();
    expect(getByText('20:00')).toBeTruthy();
    expect(queryByText('07:00')).toBeNull();
    expect(queryByText('21:00')).toBeNull();
  });

  it('la plage s’élargit pour couvrir une prestation tôt ou tard', () => {
    const { getByText } = renderWithProviders(
      <DayTimeline
        items={[makeMenage({ id: 'early', horaire_prevu: '06:30:00' }), makeMenage({ id: 'late', horaire_prevu: '21:00:00', duree_estimee_min: 60 })]}
        colors={Colors.light}
        onPressItem={() => undefined}
      />,
    );
    expect(getByText('06:00')).toBeTruthy();
    expect(getByText('22:00')).toBeTruthy();
  });

  it('un bloc = début à l’heure prévue, hauteur selon la durée (56 px / h)', () => {
    const utils = renderWithProviders(
      <DayTimeline items={[makeMenage({ horaire_prevu: '09:00:00', duree_estimee_min: 90 })]} colors={Colors.light} onPressItem={() => undefined} />,
    );
    const [box] = eventBoxes(utils);
    expect(box).toEqual({ top: 56, height: 84 - 2, left: '0%', width: '100%' });
    expect(utils.getByText('09:00–10:30')).toBeTruthy();
  });

  it('durée par défaut : 60 min pour un ménage, 30 min pour un check-in/out', () => {
    const utils = renderWithProviders(
      <DayTimeline
        items={[
          makeMenage({ id: 'm', horaire_prevu: '09:00:00', duree_estimee_min: null }),
          makeMenage({ id: 'ci', horaire_prevu: '14:00:00', duree_estimee_min: null, prestation_type: 'check_in' }),
        ]}
        colors={Colors.light}
        onPressItem={() => undefined}
      />,
    );
    expect(utils.getByText('09:00–10:00')).toBeTruthy();
    const boxes = eventBoxes(utils);
    expect(boxes[1].height).toBe(28 - 2);
  });

  it('deux prestations qui se chevauchent se placent côte à côte (2 colonnes)', () => {
    const utils = renderWithProviders(
      <DayTimeline
        items={[
          makeMenage({ id: 'a', horaire_prevu: '09:00:00', duree_estimee_min: 120 }),
          makeMenage({ id: 'b', horaire_prevu: '10:00:00', duree_estimee_min: 60 }),
          makeMenage({ id: 'c', horaire_prevu: '15:00:00', duree_estimee_min: 60 }),
        ]}
        colors={Colors.light}
        onPressItem={() => undefined}
      />,
    );
    const boxes = eventBoxes(utils);
    expect(boxes.map((b) => [b.left, b.width])).toEqual([
      ['0%', '50%'],
      ['50%', '50%'],
      ['0%', '100%'],
    ]);
  });

  it('les prestations sans heure sont listées au-dessus, et un tap ouvre la fiche', () => {
    const onPressItem = jest.fn();
    const utils = renderWithProviders(
      <DayTimeline
        items={[makeMenage({ id: 'untimed', horaire_prevu: null, logement_name: 'Sans heure' }), makeMenage({ id: 'timed', horaire_prevu: '11:00:00' })]}
        colors={Colors.light}
        onPressItem={onPressItem}
      />,
    );
    expect(utils.getByText('Sans heure')).toBeTruthy();
    expect(eventBoxes(utils)).toHaveLength(1);
    fireEvent.press(utils.getByText('Sans heure'));
    expect(onPressItem).toHaveBeenCalledWith('untimed');
    fireEvent.press(utils.getByText('Villa Azur'));
    expect(onPressItem).toHaveBeenCalledWith('timed');
  });
});
