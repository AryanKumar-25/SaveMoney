import React from 'react';
import {
  Utensils,
  Car,
  ShoppingBag,
  FileText,
  Film,
  HeartPulse,
  MoreHorizontal,
  Coffee,
  Home,
  Plane,
  Gift,
  Dumbbell,
  Tag,
  Sparkles,
  Smartphone,
  BookOpen,
  Briefcase,
  Gamepad2,
  Smile,
} from 'lucide-react';

export const AVAILABLE_CATEGORY_ICONS: Record<string, React.ElementType> = {
  Utensils,
  Car,
  ShoppingBag,
  FileText,
  Film,
  HeartPulse,
  Coffee,
  Home,
  Plane,
  Gift,
  Dumbbell,
  Tag,
  Smartphone,
  BookOpen,
  Briefcase,
  Gamepad2,
  Smile,
  MoreHorizontal,
};

export const AVAILABLE_COLORS = [
  '#F7931A', // Brand Orange
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#EAB308', // Amber
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#64748B', // Slate
];

export const DEFAULT_CATEGORY_ICONS: Record<string, string> = {
  Food: 'Utensils',
  Travel: 'Car',
  Shopping: 'ShoppingBag',
  Bills: 'FileText',
  Entertainment: 'Film',
  Health: 'HeartPulse',
  Other: 'MoreHorizontal',
};

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  Food: '#F7931A',
  Travel: '#3B82F6',
  Shopping: '#EC4899',
  Bills: '#EAB308',
  Entertainment: '#8B5CF6',
  Health: '#10B981',
  Other: '#64748B',
};

interface CategoryIconProps {
  name?: string;
  icon?: string;
  className?: string;
}

export function CategoryIcon({ name = '', icon, className = 'w-4 h-4' }: CategoryIconProps) {
  // If icon is provided directly and exists in our map
  if (icon && AVAILABLE_CATEGORY_ICONS[icon]) {
    const IconComponent = AVAILABLE_CATEGORY_ICONS[icon];
    return <IconComponent className={className} />;
  }

  // Look up default icon for name
  const mappedIconName = DEFAULT_CATEGORY_ICONS[name];
  if (mappedIconName && AVAILABLE_CATEGORY_ICONS[mappedIconName]) {
    const IconComponent = AVAILABLE_CATEGORY_ICONS[mappedIconName];
    return <IconComponent className={className} />;
  }

  // Default fallback
  return <Tag className={className} />;
}
