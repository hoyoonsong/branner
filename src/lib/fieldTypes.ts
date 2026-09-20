import type { ConditionalTriggerType, StandardAppItem } from '../types/application';

export function fieldTypeLabel(type: string): string {
  switch (type) {
    case 'short_text':
      return 'Short Text';
    case 'long_text':
      return 'Long Text';
    case 'number':
      return 'Number';
    case 'email':
      return 'Email';
    case 'phone':
      return 'Phone';
    case 'section':
      return 'Section';
    case 'address':
      return 'Address';
    case 'location':
      return 'Location';
    case 'select':
      return 'Dropdown';
    case 'multiple_choice':
      return 'Multiple Choice';
    case 'checkbox':
      return 'Checkbox';
    case 'date':
      return 'Date';
    case 'file':
      return 'File';
    case 'headshot':
      return 'Image Upload';
    case 'waiver':
      return 'Waiver';
    case 'conditional':
      return 'If / Then';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function fieldTypeHeaderClass(type: string): string {
  switch (type) {
    case 'long_text':
      return 'text-blue-600';
    case 'short_text':
      return 'text-green-600';
    case 'select':
    case 'multiple_choice':
      return 'text-purple-600';
    case 'date':
    case 'number':
      return 'text-orange-600';
    case 'checkbox':
      return 'text-pink-600';
    case 'address':
      return 'text-teal-600';
    case 'location':
      return 'text-cyan-600';
    case 'file':
      return 'text-gray-600';
    case 'waiver':
      return 'text-teal-600';
    case 'conditional':
      return 'text-indigo-600';
    default:
      return 'text-gray-600';
  }
}

export function usesOptionsField(type: string): boolean {
  return type === 'select' || type === 'multiple_choice';
}

export function triggerUsesOptions(triggerType: ConditionalTriggerType): boolean {
  return triggerType === 'select' || triggerType === 'multiple_choice';
}

export function defaultOptionsForField(type: StandardAppItem['type']): string[] | undefined {
  if (type === 'select' || type === 'multiple_choice') {
    return ['Option 1', 'Option 2'];
  }
  return undefined;
}
