import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChecklistTemplateForm from '@/components/ChecklistTemplateForm';

export default function EditChecklistTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChecklistTemplateForm templateId={id} />;
}
